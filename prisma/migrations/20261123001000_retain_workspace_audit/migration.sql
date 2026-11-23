-- DropForeignKey
ALTER TABLE "WorkspaceActivity" DROP CONSTRAINT "WorkspaceActivity_workspaceId_fkey";

-- AlterTable
ALTER TABLE "WorkspaceActivity" ALTER COLUMN "workspaceId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "WorkspaceActivity" ADD CONSTRAINT "WorkspaceActivity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

