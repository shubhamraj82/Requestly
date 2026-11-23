import { create } from "zustand";
import { useRequestPlaygroundStore } from "@/modules/request/store/useRequestStore";

type Workspace = { id: string; name: string };
type OpenRequests = Pick<
  ReturnType<typeof useRequestPlaygroundStore.getState>,
  "tabs" | "activeTabId" | "responseViewerData"
>;
const openRequests = new Map<string, OpenRequests>();

export function discardInaccessibleDrafts(workspaces: Workspace[]) {
  const allowed = new Set(workspaces.map((w) => w.id));
  for (const id of openRequests.keys())
    if (!allowed.has(id)) openRequests.delete(id);
}
interface WorkspaceState {
  selectedWorkspace: Workspace | null;
  setSelectedWorkspace: (workspace: Workspace) => void;
}
export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  selectedWorkspace: null,
  setSelectedWorkspace(workspace) {
    const previous = get().selectedWorkspace?.id;
    if (previous !== workspace.id) {
      if (previous) {
        const { tabs, activeTabId, responseViewerData } =
          useRequestPlaygroundStore.getState();
        openRequests.set(previous, { tabs, activeTabId, responseViewerData });
      }
      useRequestPlaygroundStore.setState(
        openRequests.get(workspace.id) ?? {
          tabs: [],
          activeTabId: null,
          responseViewerData: null,
        },
      );
    }
    set({ selectedWorkspace: workspace });
  },
}));
