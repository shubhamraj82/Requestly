import { NextResponse } from "next/server";
import { currentUser } from "@/modules/authentication/actions";
import { AccessError } from "@/modules/workspace/access/server";
import { inspectInvite } from "@/modules/workspace/access/service";
export async function GET(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  let path = "/join";
  let valid = false;
  try {
    await inspectInvite(token);
    valid = true;
    if (!(await currentUser())) path = "/sign-in?next=join";
  } catch (e) {
    if (!(e instanceof AccessError)) throw e;
    path = "/join?unavailable=1";
  }
  const response = NextResponse.redirect(new URL(path, req.url));
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.cookies.set("workspace-invite", valid ? token : "", {
    path: "/join",
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(req.url).protocol === "https:",
    maxAge: valid ? 3600 : 0,
  });
  return response;
}
