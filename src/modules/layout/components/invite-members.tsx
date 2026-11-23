"use client";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspaceStore } from "../store";
import {
  panelRequest,
  type Panel,
  type Operation,
  type Apply,
} from "@/modules/workspace/access/panel-client";
import {
  ConfirmChange,
  type Confirmation,
} from "@/modules/workspace/access/confirm-change";
import MembersTab from "@/modules/workspace/access/members-tab";
import InviteTab from "@/modules/workspace/access/invite-tab";

function AccessDialog({
  workspace,
}: {
  workspace: { id: string; name: string };
}) {
  const [confirm, setConfirm] = useState<{
    content: Confirmation;
    resolve: (ok: boolean) => void;
  } | null>(null);
  const cache = useQueryClient();
  const panel = useQuery({
    queryKey: ["workspace-access", workspace.id],
    queryFn: () => panelRequest<Panel>(workspace.id),
    retry: false,
    refetchInterval: 5000,
  });
  const mutation = useMutation({
    mutationFn: (op: Operation) =>
      panelRequest<{ token?: string; id?: string }>(workspace.id, op),
  });
  const apply: Apply = async (op, message, confirmation) => {
    if (
      confirmation &&
      !(await new Promise<boolean>((resolve) =>
        setConfirm({ content: confirmation, resolve }),
      ))
    )
      return undefined;
    try {
      const result = await mutation.mutateAsync(op);
      if (op.action !== "share") {
        await panel.refetch();
        void cache.invalidateQueries({ queryKey: ["workspaces"] });
        void cache.invalidateQueries({ queryKey: ["workspace", workspace.id] });
      }
      if (message) toast.success(message);
      return result;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save changes");
      return undefined;
    }
  };
  return (
    <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-100 sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Invite Members</DialogTitle>
        <DialogDescription>
          {panel.data?.access.name ?? workspace.name}
        </DialogDescription>
      </DialogHeader>
      {panel.isPending ? (
        <p role="status">Loading workspace access…</p>
      ) : panel.isError ? (
        <div role="alert">
          {panel.error.message}{" "}
          <Button variant="ghost" onClick={() => panel.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <Tabs
          defaultValue={panel.data.access.rights.invite ? "invite" : "members"}
        >
          <TabsList className="w-full">
            <TabsTrigger value="invite">Invite Members</TabsTrigger>
            <TabsTrigger value="members">
              Manage Members <small>{panel.data.members.length}</small>
            </TabsTrigger>
          </TabsList>
          <fieldset disabled={mutation.isPending} className="min-w-0 pt-2">
            <TabsContent value="invite">
              <InviteTab panel={panel.data} apply={apply} />
            </TabsContent>
            <TabsContent value="members">
              <MembersTab panel={panel.data} apply={apply} />
            </TabsContent>
          </fieldset>
        </Tabs>
      )}
      {confirm && (
        <ConfirmChange
          confirmation={confirm.content}
          finish={(ok) => {
            confirm.resolve(ok);
            setConfirm(null);
          }}
        />
      )}
    </DialogContent>
  );
}
export default function InviteMember() {
  const workspace = useWorkspaceStore((s) => s.selectedWorkspace);
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          disabled={!workspace}
          aria-label="Invite members"
          className="h-8 rounded-md px-2 text-zinc-300 hover:bg-zinc-800 hover:text-white"
        >
          <UserPlus className="size-4" />
          <span className="hidden sm:inline">Invite</span>
        </Button>
      </DialogTrigger>
      {workspace && open && (
        <AccessDialog key={workspace.id} workspace={workspace} />
      )}
    </Dialog>
  );
}
