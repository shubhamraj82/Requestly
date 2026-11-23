-- CreateTable
CREATE TABLE "SocketDefinition" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "settings" JSONB NOT NULL,

    CONSTRAINT "SocketDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocketRun" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "definitionId" TEXT,
    "snapshot" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "protocol" TEXT,
    "handshakeStatus" INTEGER,
    "closeCode" INTEGER,
    "closeReason" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "SocketRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocketEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocketEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocketDefinition_collectionId_idx" ON "SocketDefinition"("collectionId");

-- CreateIndex
CREATE INDEX "SocketRun_workspaceId_createdAt_id_idx" ON "SocketRun"("workspaceId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SocketEvent_runId_seq_key" ON "SocketEvent"("runId", "seq");

-- AddForeignKey
ALTER TABLE "SocketDefinition" ADD CONSTRAINT "SocketDefinition_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocketRun" ADD CONSTRAINT "SocketRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocketRun" ADD CONSTRAINT "SocketRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocketRun" ADD CONSTRAINT "SocketRun_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "SocketDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocketEvent" ADD CONSTRAINT "SocketEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SocketRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

