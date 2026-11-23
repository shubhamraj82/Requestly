import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { currentUser } from "@/modules/authentication/actions";
import { AccessError, actorId } from "@/modules/workspace/access/server";
import { inspectInvite, join } from "@/modules/workspace/access/service";
import { labels, permissions } from "@/modules/workspace/access/permissions";

async function accept() {
  "use server";
  const jar = await cookies();
  let workspace: string;
  try {
    workspace = await join(
      jar.get("workspace-invite")?.value ?? "",
      await actorId(),
    );
  } catch (e) {
    if (!(e instanceof AccessError)) throw e;
    redirect("/join?error=" + encodeURIComponent(e.message));
  }
  jar.set("workspace-invite", "", { path: "/join", maxAge: 0 });
  redirect("/?workspace=" + encodeURIComponent(workspace));
}
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; unavailable?: string }>;
}) {
  const query = await searchParams;
  const token = (await cookies()).get("workspace-invite")?.value ?? "";
  let link;
  let message = query.error;
  try {
    link = await inspectInvite(token);
  } catch (e) {
    if (!(e instanceof AccessError)) throw e;
    message = query.unavailable
      ? "This invitation is invalid or no longer active."
      : e.message;
  }
  if (link && !(await currentUser())) redirect("/sign-in?next=join");
  const rights = link
    ? permissions(
        link.defaultRole === "EDITOR" ? "EDITOR" : "MEMBER",
        link.defaultPermissions,
      )
    : null;
  return (
    <main className="grid min-h-dvh place-items-center bg-zinc-950 p-4 text-zinc-100">
      <section className="grid w-full max-w-md gap-5 rounded-xl border border-zinc-800 bg-zinc-900 p-7">
        <p className="text-sm text-zinc-400">Workspace invitation</p>
        <h1 className="text-2xl font-semibold">
          {link?.workspace.name ?? "Invitation unavailable"}
        </h1>
        {message && <p role="alert">{message}</p>}
        {link && rights && (
          <>
            <p>
              Join as {link.defaultRole.toLowerCase()}.{" "}
              {link.expiresAt &&
                "Expires " + link.expiresAt.toLocaleDateString() + "."}
            </p>
            <ul className="list-inside list-disc text-sm text-zinc-300">
              {Object.entries(labels)
                .filter(([key]) => rights[key as keyof typeof labels])
                .map(([key, text]) => (
                  <li key={key}>{text}</li>
                ))}
            </ul>
            <form action={accept}>
              <Button type="submit">Join Workspace</Button>
            </form>
          </>
        )}
        <Link href="/" className="text-sm underline">
          Back to workspace
        </Link>
      </section>
    </main>
  );
}
