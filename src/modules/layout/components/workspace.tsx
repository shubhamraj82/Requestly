"use client";

import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";
import { Loader, Plus, User } from "lucide-react";
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
import { useWorkspaceStore } from "../store";

const WorkSpace = () => {
  const { data: workspaces, isLoading } = useWorkspaces();
  const { selectedWorkspace, setSelectedWorkspace } = useWorkspaceStore();

  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (workspaces && workspaces.length > 0 && !selectedWorkspace) {
      setSelectedWorkspace(workspaces[0]);
    }
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
          value={selectedWorkspace?.id}
          onValueChange={(id) => {
            const ws = workspaces.find((w) => w.id === id);
            if (ws) {
              setSelectedWorkspace(ws);
            }
          }}
        >
          <SelectTrigger className="border border-indigo-400 bg-indigo-400/10 hover:bg-indigo-400/20 text-indigo-400 hover:text-indigo-300 flex flex-row items-center space-x-1">
            <User className="size-4 text-indigo-400" />
            <span className="text-sm text-indigo-400 font-semibold">
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
                My Worekspaces
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
