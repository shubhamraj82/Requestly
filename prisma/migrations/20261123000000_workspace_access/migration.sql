-- CreateEnum
CREATE TYPE "AccessStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REMOVED');

-- AlterEnum
ALTER TYPE "MEMBER_ROLE" ADD VALUE 'EDITOR';

-- DropForeignKey
ALTER TABLE "WorkspaceMember" DROP CONSTRAINT "WorkspaceMember_workspaceId_fkey";

-- AlterTable
ALTER TABLE "WorkspaceMember" ADD COLUMN     "permissions" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "status" "AccessStatus" NOT NULL DEFAULT 'ACTIVE',
ALTER COLUMN "role" SET DEFAULT 'MEMBER';

-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "authorId" TEXT;

-- AlterTable
ALTER TABLE "SocketDefinition" ADD COLUMN     "authorId" TEXT;

-- CreateTable
CREATE TABLE "WorkspaceInvitation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "defaultRole" "MEMBER_ROLE" NOT NULL DEFAULT 'MEMBER',
    "defaultPermissions" JSONB NOT NULL DEFAULT '{}',
    "expiresAt" TIMESTAMP(3),
    "maxUses" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceActivity" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetUserId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteRateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetsAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InviteRateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvitation_tokenHash_key" ON "WorkspaceInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "WorkspaceInvitation_workspaceId_createdAt_idx" ON "WorkspaceInvitation"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkspaceActivity_workspaceId_createdAt_idx" ON "WorkspaceActivity"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "InviteRateLimit_resetsAt_idx" ON "InviteRateLimit"("resetsAt");

-- CreateIndex
CREATE INDEX "WorkspaceMember_workspaceId_status_idx" ON "WorkspaceMember"("workspaceId", "status");

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocketDefinition" ADD CONSTRAINT "SocketDefinition_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceActivity" ADD CONSTRAINT "WorkspaceActivity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceActivity" ADD CONSTRAINT "WorkspaceActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceActivity" ADD CONSTRAINT "WorkspaceActivity_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Existing content predates authorship. Attribute it to the workspace creator.
UPDATE "Request" r SET "authorId" = w."ownerId" FROM "Collection" c JOIN "Workspace" w ON w.id = c."workspaceId" WHERE c.id = r."collectionId";
UPDATE "SocketDefinition" s SET "authorId" = w."ownerId" FROM "Collection" c JOIN "Workspace" w ON w.id = c."workspaceId" WHERE c.id = s."collectionId";
INSERT INTO "WorkspaceMember" (id, "workspaceId", "userId", role)
SELECT 'owner-' || id, id, "ownerId", 'ADMIN' FROM "Workspace"
ON CONFLICT ("userId", "workspaceId") DO UPDATE SET role = 'ADMIN';
ALTER TABLE "WorkspaceInvitation" ADD CHECK ("defaultRole"::text IN ('MEMBER','EDITOR')), ADD CHECK ("maxUses" IS NULL OR "maxUses" > 0), ADD CHECK ("usageCount" >= 0 AND ("maxUses" IS NULL OR "usageCount" <= "maxUses"));
