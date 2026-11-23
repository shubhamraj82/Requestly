"use client";

import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";
import { Loader, Plus, PanelsTopLeft } from "lucide-react";
import React, { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CreateWorkspace from "./create-workspace";
import { Separator } from "@/components/ui/separator";
import { useWorkspaces } from "@/modules/workspace/hooks/workspace";
import { discardInaccessibleDrafts,useWorkspaceStore } from "../store";
import { toast } from "sonner";

const WorkSpace = () => {
  const { data: workspaces, isLoading } = useWorkspaces();
  const { selectedWorkspace, setSelectedWorkspace } = useWorkspaceStore();

  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!workspaces?.length) return;
    const location = new URL(window.location.href);
    const joined = workspaces.find(w=>w.id===location.searchParams.get("workspace"));
    if (joined) {
      setSelectedWorkspace(joined);
      location.searchParams.delete("workspace");
      window.history.replaceState(null,"",location);
    } else if (!workspaces.some(w=>w.id===selectedWorkspace?.id)) {
      setSelectedWorkspace(workspaces[0]);
    }
    discardInaccessibleDrafts(workspaces);
  }, [workspaces, selectedWorkspace, setSelectedWorkspace]);

  if (isLoading) {
    return <Loader className="animate-spin size-4 text-indigo-400" />;
  }
  if (!workspaces || workspaces.length === 0) {
    return (
      <div className="font-semibold text-indigo-400">
        No workspaces found. Please create a workspace to get started.
      </div>
    );
  }
  return (
    <>
      <Hint label="Change Workspace">
        <Select
          value={selectedWorkspace?.id??""}
          onValueChange={(id) => {
            const ws = workspaces.find((w) => w.id === id);
            if (ws && ws.id !== selectedWorkspace?.id) {
              setSelectedWorkspace(ws);
              toast.success(`Switched to ${ws.name} workspace`);
            }
          }}
        >
          <SelectTrigger aria-label="Switch workspace" className="max-w-full rounded-md border-transparent bg-transparent px-2 text-zinc-200 hover:bg-zinc-800 dark:bg-transparent dark:hover:bg-zinc-800 sm:max-w-64">
            <PanelsTopLeft className="size-4 shrink-0 text-zinc-400" />
            <span className="min-w-0 truncate text-sm font-medium">
              <SelectValue placeholder="Select Workspace" />
            </span>
          </SelectTrigger>
          <SelectContent
            position="popper"
            side="bottom"
            align="end"
            sideOffset={4}
          >
            {workspaces.map((ws) => (
              <SelectItem key={ws.id} value={ws.id}>
                {ws.name}
              </SelectItem>
            ))}
            <Separator className="my-1" />
            <div className="flex flex-row items-center justify-between gap-3 p-2">
              <span className="text-sm font-semibold text-zinc-600">
                My workspaces
              </span>
              <Button
                size={"icon"}
                variant={"outline"}
                onClick={() => setIsModalOpen(true)}
              >
                <Plus size={16} className=" text-indigo-400" />
              </Button>
            </div>
          </SelectContent>
        </Select>
      </Hint>
      <CreateWorkspace isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen} />
    </>
  );
};

export default WorkSpace;
