import { actorId, AccessError } from "@/modules/workspace/access/server";
import { join } from "@/modules/workspace/access/service";

export async function POST(req: Request) {
  if (
    !req.headers.get("content-type")?.startsWith("application/json") ||
    (req.headers.has("origin") &&
      req.headers.get("origin") !== new URL(req.url).origin)
  )
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  try {
    const user = await actorId();
    const body = await req.json().catch(() => null);
    const token =
      typeof body?.token === "string" && body.token.length === 43
        ? body.token
        : "";
    return Response.json({ workspaceId: await join(token, user) });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof AccessError ? e.message : "Could not accept invitation",
      },
      { status: e instanceof AccessError ? e.status : 500 },
    );
  }
}
