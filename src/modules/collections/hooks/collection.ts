import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createCollection,
  getCollection,
  deleteCollection,
  updateCollection,
} from "../actions";

export function useCollections(workspaceId: string) {
  return useQuery({
    queryKey: ["collections", workspaceId],
    queryFn: async () => getCollection(workspaceId),
  });
}

export function useCreateCollections(worskpaceId: string, name: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => createCollection(worskpaceId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections", worskpaceId] });
    },
  });
}

export function useDeleteCollections(collectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => deleteCollection(collectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

export function useUpdateCollection(collectionId: string, name: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => updateCollection(collectionId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}
