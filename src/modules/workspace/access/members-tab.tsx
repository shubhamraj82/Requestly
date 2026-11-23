import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PermissionFields, fieldStyle } from "./permission-fields";
import { permissions, type Role } from "./permissions";
import type { Panel, Apply } from "./panel-client";

type Member = Panel["members"][number];
function MemberRow({
  m,
  panel,
  apply,
}: {
  m: Member;
  panel: Panel;
  apply: Apply;
}) {
  const [edit, setEdit] = useState(false);
  const [role, setRole] = useState<Role>(m.role);
  const [rights, setRights] = useState(permissions(role, m.permissions));
  const owner = m.user.id === panel.ownerId;
  const manage =
    panel.access.rights.manage && !owner && m.user.id !== panel.access.userId;
  const changeStatus = (status: "REMOVED" | "ACTIVE" | "SUSPENDED") => {
    const verb =
      status === "REMOVED"
        ? "Remove"
        : status === "ACTIVE"
          ? "Restore"
          : "Suspend";
    void apply(
      { action: "member", userId: m.user.id, status },
      "Member access updated",
      {
        title: verb + " access for " + m.user.name + "?",
        detail:
          status === "REMOVED"
            ? "They will need a new invitation to rejoin."
            : status === "SUSPENDED"
              ? "Their workspace access will stop immediately. You can restore it later."
              : "Their saved role and permissions will apply again.",
        confirmLabel: verb + " access",
      },
    );
  };
  return (
    <li className="grid gap-2 border-t border-zinc-800 py-3">
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarImage src={m.user.image ?? undefined} />
          <AvatarFallback>
            {m.user.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {m.user.name}{" "}
            {owner && <small className="text-zinc-400">Owner</small>}
          </p>
          <p className="truncate text-xs text-zinc-400">{m.user.email}</p>
          <small className="text-zinc-400">
            Joined {new Date(m.createdAt).toLocaleDateString()}
          </small>
        </div>
        <div className="text-right text-xs capitalize">
          {m.role.toLowerCase()}
          <p
            className={
              m.status === "ACTIVE" ? "text-emerald-300" : "text-amber-300"
            }
          >
            {m.status.toLowerCase()}
          </p>
        </div>
        {manage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={"Manage " + m.user.name}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  setEdit(true);
                  setRole(m.role);
                  setRights(permissions(m.role, m.permissions));
                }}
              >
                Edit role and permissions
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  changeStatus(m.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE")
                }
              >
                {m.status === "ACTIVE" ? "Suspend access" : "Restore access"}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => changeStatus("REMOVED")}>
                Remove member
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {edit && manage && (
        <div className="grid gap-3 rounded-lg border border-zinc-700 p-3">
          <label>
            Role
            <select
              className={fieldStyle}
              value={role}
              onChange={(e) => {
                const r = e.target.value as Role;
                setRole(r);
                setRights(permissions(r));
              }}
            >
              <option value="MEMBER">Member</option>
              <option value="EDITOR">Editor</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          <PermissionFields role={role} value={rights} change={setRights} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setRole("MEMBER");
                setRights(permissions("MEMBER"));
              }}
            >
              Set view-only
            </Button>
            <Button variant="ghost" onClick={() => setEdit(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (
                  await apply(
                    {
                      action: "member",
                      userId: m.user.id,
                      role,
                      permissions: rights,
                    },
                    "Permissions saved",
                    {
                      title: "Update access for " + m.user.name + "?",
                      detail:
                        "The new role and permissions take effect immediately.",
                      confirmLabel: "Save changes",
                    },
                  )
                )
                  setEdit(false);
              }}
            >
              Save changes
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
export default function MembersTab({
  panel,
  apply,
}: {
  panel: Panel;
  apply: Apply;
}) {
  const [showActivity, setShowActivity] = useState(false);
  const older = useInfiniteQuery({
    queryKey: [
      "workspace-activity",
      panel.access.workspaceId,
      panel.access.role,
      panel.activity.at(-1)?.id,
    ],
    enabled: false,
    initialPageParam: panel.activity.at(-1)?.id,
    queryFn: async ({ pageParam }): Promise<Panel["activity"]> => {
      const params = new URLSearchParams({
        activity: "1",
        before: pageParam ?? "",
      });
      const res = await fetch(
        "/api/workspaces/" + panel.access.workspaceId + "/access?" + params,
      );
      if (!res.ok) throw Error("Could not load older activity");
      return res.json();
    },
    getNextPageParam: (page) =>
      page.length === 100 ? page.at(-1)?.id : undefined,
  });
  const events = [...panel.activity, ...(older.data?.pages.flat() ?? [])];
  const router = useRouter();
  const [text, setText] = useState("");
  return (
    <div className="grid gap-4">
      <ul>
        {panel.members.map((m) => (
          <MemberRow key={m.user.id} m={m} panel={panel} apply={apply} />
        ))}
      </ul>
      {panel.access.role === "ADMIN" && panel.access.rights.manage && (
        <details>
          <summary className="cursor-pointer">Workspace settings</summary>
          <form
            className="mt-3 flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const name = String(
                new FormData(e.currentTarget).get("name") ?? "",
              );
              void apply({ action: "rename", name }, "Workspace renamed");
            }}
          >
            <label className="flex-1">
              Workspace name
              <input
                className={fieldStyle}
                name="name"
                defaultValue={panel.access.name}
                required
                maxLength={128}
              />
            </label>
            <Button>Save</Button>
          </form>
          <Button
            className="mt-4"
            variant="destructive"
            onClick={async () => {
              const name = panel.access.name;
              if (
                await apply(
                  { action: "deleteWorkspace", name },
                  "Workspace deleted",
                  {
                    title: "Delete workspace?",
                    detail:
                      "All collections, requests and invitations in this workspace will be permanently removed.",
                    confirmLabel: "Delete workspace",
                    match: name,
                  },
                )
              ) {
                router.replace("/");
                router.refresh();
              }
            }}
          >
            Delete workspace
          </Button>
        </details>
      )}
      <details onToggle={(e) => setShowActivity(e.currentTarget.open)}>
        <summary className="cursor-pointer">
          {panel.access.role === "ADMIN" ? "Activity log" : "Workspace updates"}
        </summary>
        <ul className="mt-2 max-h-60 overflow-auto">
          {events.map((a) => (
            <li className="border-b border-zinc-800 py-2 text-sm" key={a.id}>
              <strong>{a.actor?.name ?? "Former user"}</strong> ·{" "}
              {a.action === "comment"
                ? String((a.metadata as { text?: string })?.text ?? "")
                : a.action.replaceAll(".", " ")}{" "}
              {a.target?.name}
              <small className="block text-zinc-400">
                {new Date(a.createdAt).toLocaleString()}
              </small>
            </li>
          ))}
        </ul>
        {showActivity &&
          panel.activity.length === 100 &&
          (!older.data || older.hasNextPage) && (
            <Button
              variant="ghost"
              disabled={older.isFetching}
              onClick={() => void older.fetchNextPage()}
            >
              {older.isFetching ? "Loading…" : "Older activity"}
            </Button>
          )}
        {older.isError && <p role="alert">Could not load older activity.</p>}
        {!panel.activity.length && (
          <p className="mt-2 text-zinc-400">No updates yet.</p>
        )}
        {panel.access.rights.comment && (
          <form
            className="mt-3 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await apply({ action: "comment", text }, "Update posted"))
                setText("");
            }}
          >
            <input
              className={fieldStyle}
              aria-label="Workspace update"
              placeholder="Write an update…"
              value={text}
              maxLength={2000}
              required
              onChange={(e) => setText(e.target.value)}
            />
            <Button>Post</Button>
          </form>
        )}
      </details>
    </div>
  );
}
