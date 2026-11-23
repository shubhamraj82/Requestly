import { createHash, randomBytes, createHmac } from "node:crypto";
import { Prisma, type WorkspaceInvitation } from "@prisma/client";
import { z } from "zod";
import { terminateWorkspaceConnections } from "@/modules/realtime/server/transport";
import db from "@/lib/db";
import { AccessError, requireRight, workspaceAccess } from "./server";
import { overridesSchema, permissions } from "./permissions";

const id = z.string().min(1).max(160);
const grant = z.object({
  role: z.enum(["MEMBER", "EDITOR"]),
  permissions: overridesSchema.default({}),
  days: z.union([z.literal(1), z.literal(7), z.literal(30)]).nullable(),
  maxUses: z.number().int().positive().max(100000).nullable(),
});
export const operationSchema = z.discriminatedUnion("action", [
  grant.extend({ action: z.literal("generate"), replace: id.optional() }),
  z.object({ action: z.literal("revoke"), id }),
  z.object({ action: z.literal("share"), id }),
  z.object({
    action: z.literal("member"),
    userId: id,
    role: z.enum(["MEMBER", "EDITOR", "ADMIN"]).optional(),
    permissions: overridesSchema.optional(),
    status: z.enum(["ACTIVE", "SUSPENDED", "REMOVED"]).optional(),
  }),
  z.object({
    action: z.literal("comment"),
    text: z.string().trim().min(1).max(2000),
  }),
  z.object({ action: z.literal("deleteWorkspace"), name: z.string() }),
  z.object({
    action: z.literal("rename"),
    name: z.string().trim().min(1).max(128),
  }),
]);
const publicFields = {
  id: true,
  defaultRole: true,
  defaultPermissions: true,
  createdAt: true,
  expiresAt: true,
  maxUses: true,
  usageCount: true,
  revokedAt: true,
} as const;
const profile = { id: true, name: true, email: true, image: true } as const;
type Tx = Prisma.TransactionClient;
function digest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
// Reconstruct a link for authorized sharing without persisting its bearer token.
function tokenFor(nonce: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret)
    throw new AccessError(
      "Set BETTER_AUTH_SECRET before generating invitations",
      503,
    );
  return createHmac("sha256", secret)
    .update("workspace-invite/v1/" + nonce)
    .digest("base64url");
}
export function inviteStatus(
  link: Pick<
    WorkspaceInvitation,
    "revokedAt" | "expiresAt" | "maxUses" | "usageCount"
  >,
) {
  if (link.revokedAt) return "Revoked";
  if (link.expiresAt && link.expiresAt.getTime() <= Date.now())
    return "Expired";
  if (link.maxUses !== null && link.usageCount >= link.maxUses)
    return "Used up";
  return "Active";
}
function plainViewer(
  link: Pick<WorkspaceInvitation, "defaultRole" | "defaultPermissions">,
) {
  return (
    link.defaultRole === "MEMBER" &&
    !Object.entries(permissions("MEMBER", link.defaultPermissions)).some(
      ([key, on]) => key !== "view" && on,
    )
  );
}
async function lock(tx: Tx, workspace: string) {
  await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${workspace} FOR UPDATE`;
}
function audit(
  tx: Tx,
  workspaceId: string,
  actorId: string,
  action: string,
  targetUserId?: string,
  metadata: Prisma.InputJsonObject = {},
) {
  return tx.workspaceActivity.create({
    data: { workspaceId, actorId, action, targetUserId, metadata },
  });
}
export async function rateLimit(actor: string, action: "generate" | "accept") {
  const key = action + ":" + actor;
  const limit = action === "generate" ? 20 : 40;
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "InviteRateLimit" ("key",count,"resetsAt") VALUES (${key},1,NOW()+interval '10 minutes')
    ON CONFLICT ("key") DO UPDATE SET count = CASE WHEN "InviteRateLimit"."resetsAt" <= NOW() THEN 1 ELSE "InviteRateLimit".count+1 END,
    "resetsAt"=CASE WHEN "InviteRateLimit"."resetsAt" <= NOW() THEN EXCLUDED."resetsAt" ELSE "InviteRateLimit"."resetsAt" END
    RETURNING count`;
  if (rows[0].count > limit)
    throw new AccessError("Too many attempts. Try again in ten minutes.", 429);
}
export async function activityPage(
  access: Awaited<ReturnType<typeof workspaceAccess>>,
  cursor?: string,
) {
  const { workspaceId } = access;
  if (
    cursor &&
    !(await db.workspaceActivity.findFirst({
      where: {
        id: cursor,
        workspaceId,
        ...(access.role !== "ADMIN" ? { action: "comment" } : {}),
      },
      select: { id: true },
    }))
  )
    throw new AccessError("Activity unavailable", 404);
  return db.workspaceActivity.findMany({
    where: {
      workspaceId,
      ...(access.role !== "ADMIN" ? { action: "comment" } : {}),
    },
    select: {
      id: true,
      action: true,
      metadata: true,
      createdAt: true,
      actor: { select: { name: true } },
      target: { select: { name: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
}
export async function accessPanel(workspaceId: string, user: string) {
  const access = await workspaceAccess(workspaceId, user);
  const [members, links, activity] = await Promise.all([
    db.workspaceMember.findMany({
      where: { workspaceId, status: { not: "REMOVED" } },
      select: {
        user: { select: profile },
        role: true,
        status: true,
        createdAt: true,
        permissions: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    access.rights.invite
      ? db.workspaceInvitation.findMany({
          where: { workspaceId },
          select: publicFields,
          orderBy: { createdAt: "desc" },
        })
      : [],
    activityPage(access),
  ]);
  return {
    access,
    ownerId: access.ownerId,
    members: members.map((m) => ({
      ...m,
      role: m.role === "OWNER" ? ("ADMIN" as const) : m.role,
    })),
    links: links
      .filter((l) => access.role === "ADMIN" || plainViewer(l))
      .map((l) => ({ ...l, status: inviteStatus(l) })),
    activity,
  };
}
export async function changeAccess(
  workspaceId: string,
  user: string,
  op: z.infer<typeof operationSchema>,
) {
  if (op.action === "generate") await rateLimit(user, "generate");
  let stopConnections = false;
  const result = await db.$transaction(async (tx) => {
    await lock(tx, workspaceId);
    const access = await workspaceAccess(workspaceId, user, tx);
    if (op.action === "comment") {
      requireRight(access, "comment");
      await audit(tx, workspaceId, user, "comment", undefined, {
        text: op.text,
      });
      return {};
    }
    if (op.action === "share") {
      requireRight(access, "invite");
      const link = await tx.workspaceInvitation.findFirst({
        where: { id: op.id, workspaceId },
      });
      if (
        !link ||
        inviteStatus(link) !== "Active" ||
        (access.role !== "ADMIN" && !plainViewer(link))
      )
        throw new AccessError();
      const token = tokenFor(link.id);
      if (digest(token) !== link.tokenHash)
        throw new AccessError(
          "Regenerate this invitation after changing the signing secret",
          409,
        );
      return { token };
    }
    if (access.role !== "ADMIN") throw new AccessError();
    if (op.action === "deleteWorkspace") {
      requireRight(access, "delete");
      if (op.name !== access.name)
        throw new AccessError(
          "Enter the current workspace name to confirm deletion",
          400,
        );
      await audit(tx, workspaceId, user, "workspace.deleted", undefined, {
        workspaceId,
      });
      await tx.$executeRaw`UPDATE "WorkspaceActivity" SET metadata = metadata || jsonb_build_object('workspaceId',"workspaceId") WHERE "workspaceId" = ${workspaceId}`;
      await tx.workspace.delete({ where: { id: workspaceId } });
      return {};
    }
    if (op.action === "rename") {
      requireRight(access, "manage");
      await tx.workspace.update({
        where: { id: workspaceId },
        data: { name: op.name },
      });
      await audit(tx, workspaceId, user, "workspace.renamed");
      return {};
    }
    if (op.action === "generate" || op.action === "revoke") {
      requireRight(access, "invite");
      const previous = op.action === "generate" ? op.replace : op.id;
      if (previous) {
        const result = await tx.workspaceInvitation.updateMany({
          where: { id: previous, workspaceId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        if (!result.count) throw new AccessError("Invitation unavailable", 409);
        await audit(tx, workspaceId, user, "invitation.revoked", undefined, {
          invitation: previous,
        });
      }
      if (op.action === "revoke") return {};
      const nonce = randomBytes(24).toString("base64url");
      const token = tokenFor(nonce);
      const link = await tx.workspaceInvitation.create({
        data: {
          id: nonce,
          workspaceId,
          createdBy: user,
          tokenHash: digest(token),
          defaultRole: op.role,
          defaultPermissions: permissions(op.role, op.permissions),
          maxUses: op.maxUses,
          expiresAt: op.days ? new Date(Date.now() + op.days * 86400000) : null,
        },
      });
      await audit(tx, workspaceId, user, "invitation.created", undefined, {
        invitation: link.id,
        role: op.role,
      });
      return { token, id: link.id };
    }
    requireRight(access, "manage");
    if (op.userId === user || op.userId === access.ownerId)
      throw new AccessError(
        "Your own access and the workspace owner are protected",
      );
    const where = { userId_workspaceId: { userId: op.userId, workspaceId } };
    const target = await tx.workspaceMember.findUnique({ where });
    if (!target || target.status === "REMOVED")
      throw new AccessError("Member unavailable", 404);
    const role = op.role ?? (target.role === "OWNER" ? "ADMIN" : target.role);
    const rights = permissions(
      role,
      op.permissions ?? (role === target.role ? target.permissions : {}),
    );
    stopConnections =
      (op.status ?? target.status) !== "ACTIVE" ||
      !rights.view ||
      !rights.createRequests;
    await tx.workspaceMember.update({
      where,
      data: { role, permissions: rights, status: op.status },
    });
    await audit(tx, workspaceId, user, "member.updated", op.userId, {
      role,
      permissions: rights,
      status: op.status ?? target.status,
    });
    return {};
  });
  if (op.action === "member" && stopConnections)
    terminateWorkspaceConnections(workspaceId, op.userId);
  if (op.action === "deleteWorkspace")
    terminateWorkspaceConnections(workspaceId);
  return result;
}
export async function inspectInvite(token: string) {
  if (!/^[\w-]{43}$/.test(token))
    throw new AccessError("Invalid invitation", 404);
  const link = await db.workspaceInvitation.findUnique({
    where: { tokenHash: digest(token) },
    select: { ...publicFields, workspace: { select: { name: true } } },
  });
  if (!link) throw new AccessError("Invalid invitation", 404);
  const status = inviteStatus(link);
  if (status !== "Active")
    throw new AccessError("Invitation " + status.toLowerCase(), 410);
  return link;
}
export async function join(token: string, user: string) {
  await rateLimit(user, "accept");
  const hash = digest(token);
  return db.$transaction(async (tx) => {
    const lookup = await tx.workspaceInvitation.findUnique({
      where: { tokenHash: hash },
      select: { workspaceId: true },
    });
    if (!lookup) throw new AccessError("Invalid invitation", 404);
    const { workspaceId } = lookup;
    await lock(tx, workspaceId);
    const link = await tx.workspaceInvitation.findUniqueOrThrow({
      where: { tokenHash: hash },
    });
    const status = inviteStatus(link);
    if (status !== "Active")
      throw new AccessError("Invitation " + status.toLowerCase(), 410);
    const existing = await tx.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: user, workspaceId } },
    });
    if (existing?.status === "ACTIVE") {
      await workspaceAccess(workspaceId, user, tx);
      return workspaceId;
    }
    if (
      existing &&
      (existing.status === "SUSPENDED" || link.createdAt <= existing.updatedAt)
    )
      throw new AccessError("Access to this workspace has been restricted");
    const data = {
      role: link.defaultRole,
      permissions: link.defaultPermissions as Prisma.InputJsonObject,
      status: "ACTIVE" as const,
      createdAt: new Date(),
    };
    await tx.workspaceMember.upsert({
      where: { userId_workspaceId: { userId: user, workspaceId } },
      create: { workspaceId, userId: user, ...data },
      update: data,
    });
    await tx.workspaceInvitation.update({
      where: { id: link.id },
      data: { usageCount: { increment: 1 } },
    });
    await audit(tx, workspaceId, user, "member.joined", user, {
      role: link.defaultRole,
    });
    return workspaceId;
  });
}
