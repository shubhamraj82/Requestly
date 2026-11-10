import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addRequestToCollection,
  saveRequest,
  getAllRequestFromCollection,
  Request,
} from "../actions";

export function useAddRequestToCollection(collectionId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn:async(value:Request)=>addRequestToCollection(collectionId,value),
        onSuccess:(data)=>{
            queryClient.invalidateQueries({queryKey:["requests",collectionId]})
            console.log("Request added successfully",data);
        }
    })
}

export function useGetAllRequestFromCollection(collectionId:string){
    return useQuery({
        queryKey:["requests",collectionId],
        queryFn:async()=>getAllRequestFromCollection(collectionId)
    })
}

export function useSaveREquest(id:string){
    const queryClient=useQueryClient();
    return useMutation({
        mutationFn:async(value:Request)=>saveRequest(id,value),
        onSuccess:(data)=>{
            queryClient.invalidateQueries({queryKey:["requests"]})
            console.log("Request updated successfully",data);
        }
    })
}