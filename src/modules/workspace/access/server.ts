import type { Prisma } from "@prisma/client";
import db from "@/lib/db";
import { currentUser } from "@/modules/authentication/actions";
import { permissions, type Capability, type Role } from "./permissions";

export class AccessError extends Error {
  constructor(
    message = "Workspace access denied",
    public status = 403,
  ) {
    super(message);
  }
}
export async function actorId() {
  const user = await currentUser();
  if (!user) throw new AccessError("Sign in to continue", 401);
  return user.id;
}
export async function workspaceAccess(
  workspaceId: string,
  userId: string,
  tx: Prisma.TransactionClient = db,
) {
  if (!workspaceId) throw new AccessError();
  const workspace = await tx.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      ownerId: true,
      name: true,
      members: {
        where: { userId },
        select: { status: true, role: true, permissions: true },
      },
    },
  });
  if (!workspace) throw new AccessError();
  const member = workspace.members[0];
  const owner = workspace.ownerId === userId;
  if (!owner && member?.status !== "ACTIVE") throw new AccessError();
  const role: Role = owner || member.role === "OWNER" ? "ADMIN" : member.role;
  const rights = permissions(role, owner ? {} : member.permissions);
  if (!rights.view) throw new AccessError();
  return {
    workspaceId,
    userId,
    role,
    rights,
    owner,
    ownerId: workspace.ownerId,
    name: workspace.name,
  };
}
export type Access = Awaited<ReturnType<typeof workspaceAccess>>;
export function requireRight(
  access: Access,
  right: Capability | "delete" | "editRequest",
  authorId?: string | null,
) {
  const allowed =
    right === "delete"
      ? access.role === "ADMIN"
      : right === "editRequest"
        ? access.rights.editAll ||
          (access.rights.editOwn && access.userId === authorId)
        : access.rights[right];
  if (!allowed) throw new AccessError();
}
export async function authorize(
  workspace: string,
  right: Capability | "delete",
) {
  const access = await workspaceAccess(workspace, await actorId());
  requireRight(access, right);
  return access;
}
export async function collectionAccess(
  id: string,
  right: Capability | "delete",
) {
  const user = await actorId();
  const collection = await db.collection.findUnique({
    where: { id },
    select: { workspaceId: true },
  });
  if (!collection) throw new AccessError();
  const access = await workspaceAccess(collection.workspaceId, user);
  requireRight(access, right);
  return access;
}
export async function requestAccess(
  id: string,
  right: "editRequest" | "delete",
) {
  const user = await actorId();
  const request = await db.request.findUnique({
    where: { id },
    select: { authorId: true, collection: { select: { workspaceId: true } } },
  });
  if (!request) throw new AccessError();
  const access = await workspaceAccess(request.collection.workspaceId, user);
  requireRight(access, right, request.authorId);
  return { ...access, authorId: request.authorId };
}

// Access changes take an exclusive workspace row lock. Content writes take a shared
// lock and re-read the grant, so a revoked grant cannot commit a later write.
export async function writeContent<T>(
  scope: Access,
  right: Capability | "delete" | "editRequest",
  authorId: string | null,
  action: string,
  write: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${scope.workspaceId} FOR SHARE`;
    const access = await workspaceAccess(scope.workspaceId, scope.userId, tx);
    requireRight(access, right, authorId);
    const result = await write(tx);
    await tx.workspaceActivity.create({
      data: { workspaceId: scope.workspaceId, actorId: scope.userId, action },
    });
    return result;
  });
}
