import { z } from "zod";
import { currentUser } from "@/modules/authentication/actions";
import db from "@/lib/db";
import { settingsSchema } from "@/modules/realtime/settings";
import {
  workspaceChanged,
  workspaceStream,
  command,
  destination,
  eventRevision,
  waitForCommit,
  recover,
  start,
} from "@/modules/realtime/server/transport";

export const runtime = "nodejs";
const fail = (error: string, status = 400) =>
  Response.json({ error }, { status });
const scope = (workspaceId: string, userId: string) => ({
  id: workspaceId,
  OR: [{ ownerId: userId }, { members: { some: { userId } } }],
});
async function access(workspace: string) {
  const user = await currentUser();
  if (
    !user ||
    !(await db.workspace.findFirst({
      where: scope(workspace, user.id),
      select: { id: true },
    }))
  )
    return null;
  await recover();
  return user;
}
const streamHeaders = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
};
const pageSize = 50;
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const workspaceId = p.get("workspace") || "";
  if (!(await access(workspaceId))) return fail("Workspace unavailable", 403);
  if (p.has("changes"))
    return new Response(workspaceStream(workspaceId, req.signal), {
      headers: streamHeaders,
    });
  const runId = p.get("run");
  if (!runId) {
    const cursor = p.get("cursor");
    const [definitions, runs, collections] = await Promise.all([
      db.socketDefinition.findMany({
        where: { collection: { workspaceId } },
        orderBy: { name: "asc" },
      }),
      db.socketRun.findMany({
        where: { workspaceId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: pageSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      db.collection.findMany({
        where: { workspaceId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);
    return Response.json({ definitions, runs, collections });
  }
  const run = await db.socketRun.findFirst({
    where: { id: runId, workspaceId },
  });
  if (!run) return fail("Run unavailable", 404);
  if (!p.has("stream")) {
    const before = Number(p.get("before") || 2147483647);
    const events = await db.socketEvent.findMany({
      where: { runId, seq: { lt: before } },
      orderBy: { seq: "desc" },
      take: pageSize,
    });
    return Response.json({ run, events: events.reverse() });
  }
  let seq = Number(req.headers.get("last-event-id") || p.get("after") || 0);
  let cancelled = false;
  return new Response(
    new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (value: string) =>
          controller.enqueue(encoder.encode(value));
        // Rotate periodically so each reconnect rechecks the session and membership.
        const deadline = Date.now() + 15000;
        try {
          while (!cancelled && !req.signal.aborted && Date.now() < deadline) {
            if ((controller.desiredSize ?? 0) <= 0) break;
            const revision = eventRevision();
            const current = await db.socketRun.findUniqueOrThrow({
              where: { id: runId },
              select: { status: true, endedAt: true, error: true },
            });
            const rows = await db.socketEvent.findMany({
              where: { runId, seq: { gt: seq } },
              orderBy: { seq: "asc" },
              take: pageSize,
            });
            for (const row of rows) {
              seq = row.seq;
              send(`id: ${seq}\ndata: ${JSON.stringify(row)}\n\n`);
            }
            send(
              `retry: 250\nevent: status\ndata: ${JSON.stringify(current)}\n\n`,
            );
            if (rows.length === pageSize) continue;
            if (current.endedAt) {
              send("event: end\ndata: {}\n\n");
              break;
            }
            await waitForCommit(runId, revision, req.signal);
          }
          if (!cancelled) controller.close();
        } catch (error) {
          if (!cancelled) controller.error(error);
        }
      },
      cancel() {
        cancelled = true;
      },
    }),
    {
      headers: streamHeaders,
    },
  );
}

const bodySchema = z.object({
  workspace: z.string(),
  action: z.enum(["save", "delete", "connect", "send", "ping", "disconnect"]),
  id: z.string().optional(),
  collection: z.string().optional(),
  name: z.string().trim().min(1).max(128).optional(),
  settings: settingsSchema.optional(),
  secrets: z.record(z.string(), z.string().max(4096)).default({}),
  attempt: z.number().int().min(1).max(4).default(1),
  format: z.enum(["text", "binary", "json"]).default("text"),
  payload: z.string().max(90000).default(""),
});
export async function POST(req: Request) {
  if (
    !req.headers.get("content-type")?.startsWith("application/json") ||
    (req.headers.has("origin") &&
      req.headers.get("sec-fetch-site") !== "same-origin" &&
      req.headers.get("origin") !== new URL(req.url).origin)
  )
    return fail("Invalid request origin", 403);
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Invalid request fields");
  const {
    workspace: workspaceId,
    action,
    id,
    collection,
    name,
    settings,
    secrets,
    attempt,
    format,
    payload,
  } = parsed.data;
  const user = await access(workspaceId);
  if (!user) return fail("Workspace unavailable", 403);
  if (["disconnect", "ping", "send"].includes(action)) {
    if (
      !id ||
      !(await db.socketRun.findFirst({
        where: { id, workspaceId, userId: user.id },
      }))
    )
      return fail("Run unavailable", 404);
    try {
      await command(id, action, format, payload);
      return Response.json({ id });
    } catch (error) {
      return fail(
        error instanceof SyntaxError
          ? "Invalid JSON"
          : (error as Error).message,
      );
    }
  }
  if (
    id &&
    !(await db.socketDefinition.findFirst({
      where: { id, collection: { workspaceId } },
    }))
  )
    return fail("Saved socket unavailable", 404);
  if (action === "delete") {
    if (!id) return fail("Missing saved connection ID");
    await db.socketDefinition.delete({ where: { id } });
    workspaceChanged(workspaceId);
    return Response.json({ id });
  }
  if (!settings) return fail("Missing settings");
  let url: URL;
  try {
    url = destination(settings);
  } catch {
    return fail("Invalid WebSocket URL");
  }
  if (
    [...new URL(settings.url).searchParams.keys()].some((k) =>
      /token|secret|password|api.?key/i.test(k),
    )
  )
    return fail(
      "Move sensitive URL parameters into the parameter editor and use {{secret}}",
    );
  if (
    [...settings.headers, ...settings.parameters].some(
      (h) =>
        /authorization|cookie|token|secret|password|key/i.test(h.key) &&
        h.value !== "{{secret}}",
    )
  )
    return fail(
      "Use {{secret}} for sensitive fields and enter their values at connect time",
    );
  if (action === "save") {
    if (
      !name ||
      !collection ||
      !(await db.collection.findFirst({
        where: { id: collection, workspaceId },
      }))
    )
      return fail("Choose a collection and name");
    const data = { name, collectionId: collection, settings };
    const saved = id
      ? await db.socketDefinition.update({ where: { id }, data })
      : await db.socketDefinition.create({ data });
    workspaceChanged(workspaceId);
    return Response.json(saved);
  }
  url.search = "";
  const snapshot = {
    ...settings,
    url: url.href,
    draft: "",
    parameters: [...destination(settings).searchParams.keys()].map((key) => ({
      key,
    })),
    headers: settings.headers.map((h) => ({ key: h.key, enabled: h.enabled })),
  };
  const run = await db.socketRun.create({
    data: {
      workspaceId,
      userId: user.id,
      definitionId: id,
      snapshot,
      status: "connecting",
      attempt,
    },
  });
  try {
    start(run.id, workspaceId, settings, secrets);
  } catch {
    await db.socketRun.update({
      where: { id: run.id },
      data: {
        status: "error",
        endedAt: new Date(),
        error: "Invalid or restricted connection settings",
        events: {
          create: {
            seq: 1,
            kind: "error",
            format: "text",
            payload: "Invalid or restricted connection settings",
            bytes: Buffer.byteLength(
              "Invalid or restricted connection settings",
            ),
          },
        },
      },
    });
  }
  workspaceChanged(workspaceId);
  return Response.json({ id: run.id });
}
