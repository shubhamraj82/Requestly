"use server";
import db from "@/lib/db";
import {
  authorize,
  collectionAccess,
  writeContent,
} from "@/modules/workspace/access/server";

export async function createCollection(workspaceId: string, name: string) {
  const access = await authorize(workspaceId, "editWorkspace");
  return writeContent(
    access,
    "editWorkspace",
    null,
    "collection.created",
    (tx) => tx.collection.create({ data: { workspaceId, name } }),
  );
}
export async function getCollection(workspaceId: string) {
  await authorize(workspaceId, "view");
  return db.collection.findMany({ where: { workspaceId } });
}
export async function deleteCollection(id: string) {
  const access = await collectionAccess(id, "delete");
  await writeContent(access, "delete", null, "collection.deleted", (tx) =>
    tx.collection.delete({ where: { id, workspaceId: access.workspaceId } }),
  );
}
export async function updateCollection(id: string, name: string) {
  const access = await collectionAccess(id, "editWorkspace");
  await writeContent(
    access,
    "editWorkspace",
    null,
    "collection.updated",
    (tx) =>
      tx.collection.update({
        where: { id, workspaceId: access.workspaceId },
        data: { name },
      }),
  );
}
