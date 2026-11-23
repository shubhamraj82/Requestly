import {
  actorId,
  AccessError,
  workspaceAccess,
} from "@/modules/workspace/access/server";
import {
  accessPanel,
  activityPage,
  changeAccess,
  operationSchema,
} from "@/modules/workspace/access/service";
type Context = { params: Promise<{ workspace: string }> };
function errorResponse(e: unknown) {
  return Response.json(
    {
      error:
        e instanceof AccessError ? e.message : "Workspace operation failed",
    },
    { status: e instanceof AccessError ? e.status : 500 },
  );
}
export async function GET(req: Request, ctx: Context) {
  try {
    const { workspace } = await ctx.params;
    const user = await actorId();
    const params = new URL(req.url).searchParams;
    if (params.has("activity"))
      return Response.json(
        await activityPage(
          await workspaceAccess(workspace, user),
          params.get("before") ?? undefined,
        ),
        { headers: { "Cache-Control": "private, no-store" } },
      );
    return Response.json(await accessPanel(workspace, user), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(req: Request, ctx: Context) {
  if (
    !req.headers.get("content-type")?.startsWith("application/json") ||
    (req.headers.has("origin") &&
      req.headers.get("origin") !== new URL(req.url).origin)
  )
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  try {
    const user = await actorId();
    const input = operationSchema.safeParse(await req.json().catch(() => null));
    if (!input.success)
      throw new AccessError("Check the invitation or permission settings", 400);
    return Response.json(
      await changeAccess((await ctx.params).workspace, user, input.data),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
