import type { accessPanel, operationSchema } from "./service";
import type { z } from "zod";
type Wire<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Wire<U>[]
    : T extends object
      ? { [K in keyof T]: Wire<T[K]> }
      : T;
export type Panel = Wire<Awaited<ReturnType<typeof accessPanel>>>;
export type Operation = z.infer<typeof operationSchema>;
export type Apply = (
  op: Operation,
  message: string,
  confirmation?: import("./confirm-change").Confirmation,
) => Promise<{ token?: string; id?: string } | undefined>;
export async function panelRequest<T>(
  workspace: string,
  op?: Operation,
): Promise<T> {
  const res = await fetch(
    "/api/workspaces/" + encodeURIComponent(workspace) + "/access",
    op
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(op),
        }
      : { cache: "no-store" },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Workspace unavailable");
  return data;
}
