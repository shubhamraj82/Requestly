import { useState } from "react";
import { Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { permissions } from "./permissions";
import { PermissionFields, fieldStyle } from "./permission-fields";
import type { Apply, Panel } from "./panel-client";

export default function InviteTab({
  panel,
  apply,
}: {
  panel: Panel;
  apply: Apply;
}) {
  const [role, setRole] = useState<"MEMBER" | "EDITOR">("MEMBER");
  const [rights, setRights] = useState(permissions("MEMBER"));
  const [days, setDays] = useState("7");
  const [limit, setLimit] = useState("");
  const [url, setUrl] = useState("");
  const [issued, setIssued] = useState("");
  const canGenerate =
    panel.access.role === "ADMIN" && panel.access.rights.invite;
  const invitationUrl = (token: string) =>
    new URL("/invite/" + token, panel.inviteOrigin ?? window.location.origin).href;
  const generate = async (replace?: string) => {
    const maxUses = limit === "" ? null : Number(limit);
    if (
      maxUses !== null &&
      (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100000)
    ) {
      toast.error("Enter a usage limit between 1 and 100,000");
      return;
    }
    const result = await apply(
      {
        action: "generate",
        replace,
        role,
        permissions: rights,
        days: days ? (Number(days) as 1 | 7 | 30) : null,
        maxUses,
      },
      "Invitation ready",
      replace
        ? {
            title: "Regenerate invitation?",
            detail:
              "The old link will stop working. The new link will use the settings above.",
            confirmLabel: "Regenerate",
          }
        : undefined,
    );
    if (result?.token) {
      setUrl(invitationUrl(result.token));
      setIssued(result.id ?? "");
    }
  };
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Link copied");
    } catch {
      setUrl(text);
      toast.info("Select and copy the invitation link");
    }
  }
  const activeUrl =
    issued && !panel.links.some((l) => l.id === issued && l.status === "Active")
      ? ""
      : url;
  return (
    <div className="grid gap-4">
      {canGenerate ? (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void generate();
          }}
        >
          <fieldset>
            <legend className="mb-2 font-medium">
              Default invitation role
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(["MEMBER", "EDITOR"] as const).map((r) => (
                <label
                  key={r}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${role === r ? "border-emerald-300/50 bg-emerald-300/5" : "border-zinc-700"}`}
                >
                  <input
                    type="radio"
                    name="invite-role"
                    checked={r === role}
                    onChange={() => {
                      setRole(r);
                      setRights(permissions(r));
                    }}
                    className="accent-emerald-300"
                  />
                  <span>
                    <strong className="block font-medium">
                      {r === "MEMBER" ? "Member" : "Editor"}
                    </strong>
                    <span className="text-xs text-zinc-400">
                      {r === "MEMBER"
                        ? "View only by default"
                        : "Create and edit requests"}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5">
              Expires after
              <select
                className={fieldStyle}
                value={days}
                onChange={(e) => setDays(e.target.value)}
              >
                <option value="">Never</option>
                {[1, 7, 30].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "day" : "days"}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              Usage limit
              <Input
                type="number"
                min={1}
                max={100000}
                placeholder="Unlimited"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
            </label>
          </div>
          <details>
            <summary className="cursor-pointer text-sm">
              Default permissions
            </summary>
            <PermissionFields role={role} value={rights} change={setRights} />
          </details>
          <Button
            type="submit"
            className="w-full bg-emerald-200 text-zinc-950 hover:bg-emerald-100"
          >
            <Link2 />
            Generate Invite Link
          </Button>
        </form>
      ) : (
        <p className="text-sm text-zinc-400">
          {panel.access.rights.invite
            ? "Share an active view-only invitation created by an admin."
            : "Workspace admins manage invitation links."}
        </p>
      )}
      {activeUrl && (
        <label className="grid gap-2">
          Invitation link
          <span className="flex gap-2">
            <Input
              readOnly
              value={activeUrl}
              onFocus={(e) => e.target.select()}
            />
            <Button variant="outline" onClick={() => copy(activeUrl)}>
              <Copy />
              Copy Link
            </Button>
          </span>
        </label>
      )}
      {panel.access.rights.invite && (
        <section className="grid gap-2">
          <h3 className="font-medium">Invitations</h3>
          {!panel.links.length && (
            <p className="text-sm text-zinc-400">No invitations yet.</p>
          )}
          {panel.links.map((l) => (
            <div
              key={l.id}
              className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 py-2"
            >
              <div>
                <div className="capitalize">
                  {l.defaultRole.toLowerCase()}{" "}
                  <span className="ml-1 text-xs text-zinc-400">{l.status}</span>
                </div>
                <small className="text-zinc-400">
                  {l.usageCount} / {l.maxUses ?? "∞"} uses ·{" "}
                  {l.expiresAt
                    ? "Expires " + new Date(l.expiresAt).toLocaleDateString()
                    : "No expiration"}
                </small>
              </div>
              <div className="flex flex-wrap gap-1">
                {l.status === "Active" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      const result = await apply(
                        { action: "share", id: l.id },
                        "",
                      );
                      if (result?.token) {
                        setIssued(l.id);
                        const link =
                          invitationUrl(result.token);
                        setUrl(link);
                        await copy(link);
                      }
                    }}
                  >
                    Copy link
                  </Button>
                )}
                {canGenerate && !l.revokedAt && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        void generate(l.id);
                      }}
                    >
                      Regenerate
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        void apply(
                          { action: "revoke", id: l.id },
                          "Invitation revoked",
                          {
                            title: "Revoke invitation?",
                            detail:
                              "Anyone with this link will lose the ability to join. Existing members keep their current access.",
                            confirmLabel: "Revoke link",
                          },
                        );
                      }}
                    >
                      Revoke
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
