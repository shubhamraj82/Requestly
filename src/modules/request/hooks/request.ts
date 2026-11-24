import { useWorkspaceStore } from "@/modules/layout/store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addRequestToCollection,
  saveRequest,
  run,
  deleteRequest,
  getAllRequestFromCollection,
  Request,
} from "../actions";
import { useRequestPlaygroundStore } from "../store/useRequestStore";

export function useAddRequestToCollection(collectionId: string) {
     const workspace=useWorkspaceStore(s=>s.selectedWorkspace?.id);
     const { updateTabFromSavedRequest,activeTabId } = useRequestPlaygroundStore();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn:async(value:Request)=>addRequestToCollection(collectionId,value),
        onMutate:()=>({workspace,activeTabId}),
        onSuccess:(data,_value,origin)=>{
            queryClient.invalidateQueries({queryKey:["requests",collectionId]})
            if(!origin?.activeTabId || origin.workspace !==useWorkspaceStore.getState().selectedWorkspace?.id) return;
            // @ts-ignore
            updateTabFromSavedRequest(origin.activeTabId,data)
        }
    })
}

export function useGetAllRequestFromCollection(collectionId:string){
    return useQuery({
        queryKey:["requests",collectionId],
        queryFn:async()=>getAllRequestFromCollection(collectionId)
    })
}

export function useSaveRequest(id:string){
    const queryClient=useQueryClient();
    const { updateTabFromSavedRequest,activeTabId } = useRequestPlaygroundStore();
    const workspace=useWorkspaceStore(s=>s.selectedWorkspace?.id);
    return useMutation({
        mutationFn:async(value:Request)=>saveRequest(id,value),
        onMutate:()=>({workspace,activeTabId}),
        onSuccess:(data,_value,origin)=>{
            queryClient.invalidateQueries({queryKey:["requests"]})
            if(!origin?.activeTabId || origin.workspace !==useWorkspaceStore.getState().selectedWorkspace?.id) return;
            // @ts-ignore
            updateTabFromSavedRequest(origin.activeTabId,data)
        }
    })
}

export function useDeleteRequest(id: string, collectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => deleteRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests", collectionId] });
    },
  });
}


export function useRunRequest() {

  const workspace=useWorkspaceStore(s=>s.selectedWorkspace?.id);
  const {setResponseViewerData} = useRequestPlaygroundStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requestData: {
      requestId?: string;
      method: string;
      url: string;
      headers?: string;
      parameters?: string;
      body?: string;
    }) => await run({...requestData,workspaceId:workspace ?? ""}),
    onMutate:()=>({workspace, tabId: useRequestPlaygroundStore.getState().activeTabId}),
    onSuccess: (data,_request,origin) => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      if(origin?.workspace !==useWorkspaceStore.getState().selectedWorkspace?.id)return;
      // @ts-ignore
      setResponseViewerData({ ...data, comparisonScope: JSON.stringify([workspace, _request.requestId ?? origin?.tabId, _request.method, _request.url]) });
    },
  });
}
