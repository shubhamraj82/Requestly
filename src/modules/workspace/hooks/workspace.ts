import {useWorkspaceStore} from "@/modules/layout/store";
import { useQuery,useMutation,useQueryClient } from "@tanstack/react-query";
import {createWorkspaces, getWorkspaceById, getWorkspaces} from "../actions"

export function useWorkspaces(){
    return useQuery({
        refetchInterval:5000,
        queryKey: ["workspaces"],
        queryFn:async()=>getWorkspaces()
    })
}

export function useCreateWorkspace(){
    const queryClient=useQueryClient()
    return useMutation({
        mutationFn:async(name:string)=>createWorkspaces(name),
        onSuccess:()=>{
            queryClient.invalidateQueries({queryKey:["workspaces"]})
        }
    })
}

export function useGetWorkspace(id:string){
    return useQuery({
        enabled:Boolean(id),
        refetchInterval:5000,
        retry:false,
        queryKey:["workspace",id],
        queryFn:async()=>getWorkspaceById(id)
    })
}
export function useAccess() {
    const workspace = useWorkspaceStore(s=>s.selectedWorkspace);
    const query = useGetWorkspace(workspace?.id ?? "");
    return query.isError ? undefined : query.data?.access;
}
