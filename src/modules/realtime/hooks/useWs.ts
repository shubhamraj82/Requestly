"use client";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Settings } from "../settings";

export type Definition = {
  id: string;
  collectionId: string;
  name: string;
  settings: Settings;
};
export type Run = {
  id: string;
  status: string;
  snapshot: Settings;
  createdAt: string;
  endedAt: string | null;
  error: string | null;
  attempt: number;
  protocol: string | null;
  handshakeStatus: number | null;
  closeCode: number | null;
  closeReason: string | null;
};
export type Entry = {
  seq: number;
  kind: string;
  payload: string;
  format: string;
  bytes: number;
  createdAt: string;
};
export type Listing = {
  definitions: Definition[];
  collections: { id: string; name: string }[];
  runs: Run[];
};
export function endpoint(
  workspace: string,
  params: Record<string, string> = {},
) {
  return "/api/realtime?" + new URLSearchParams({ workspace, ...params });
}
export async function api<T>(
  url: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(
    url,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {},
  );
  const result = await res.json().catch(() => {
    throw new Error(`WebSocket service returned an unreadable response (HTTP ${res.status}). Check the server logs and retry.`);
  });
  if (!res.ok) throw Error(result.error || "WebSocket request failed");
  return result;
}
export function useSockets(workspace: string, cursor = "") {
  return useQuery({
    queryKey: ["sockets", workspace, cursor],
    queryFn: () => api<Listing>(endpoint(workspace, { cursor })),
    enabled: !!workspace,
  });
}

export function useWorkspaceSocketChanges(workspace?: string) {
  const cache = useQueryClient();
  useEffect(() => {
    if (!workspace) return;
    const stream = new EventSource(endpoint(workspace, { changes: "1" }));
    stream.onmessage = () => {
      void cache.invalidateQueries({ queryKey: ["sockets", workspace] });
    };
    return () => stream.close();
  }, [workspace, cache]);
}
