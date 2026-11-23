import { z } from "zod";

export const labels = {
  view: "View workspace",
  editWorkspace: "Edit workspace content",
  createRequests: "Create requests",
  editOwn: "Edit own requests",
  editAll: "Edit all requests",
  comment: "Add comments",
  invite: "Invite members",
  manage: "Manage members",
} as const;
export type Capability = keyof typeof labels;
export type Role = "ADMIN" | "EDITOR" | "MEMBER";
export type Permissions = Record<Capability, boolean>;
export const overridesSchema = z.partialRecord(
  z.enum(Object.keys(labels) as [Capability, ...Capability[]]),
  z.boolean(),
);
export function permissions(role: Role, overrides: unknown = {}): Permissions {
  const admin = role === "ADMIN";
  const editor = role === "EDITOR";
  const defaults = {
    view: true,
    editWorkspace: admin || editor,
    createRequests: admin || editor,
    editOwn: admin || editor,
    editAll: admin || editor,
    comment: admin || editor,
    invite: admin,
    manage: admin,
  };
  const parsed = overridesSchema.safeParse(overrides);
  const result = { ...defaults, ...(parsed.success ? parsed.data : {}) };
  if (!admin) result.manage = false;
  if (role === "MEMBER") result.invite = false;
  return result;
}
