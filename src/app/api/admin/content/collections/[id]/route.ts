import { route } from "@/lib/api";
import { collectionSchema } from "@/lib/validations/admin/content";
import { deleteCollection, getCollection, updateCollection } from "@/services/admin/content";
import { logActivity } from "@/services/audit";

const opts = { auth: "staff", permission: "content.manage" } as const;

export const GET = route<{ id: string }>(opts, async ({ params }) => getCollection(params.id));

export const PUT = route<{ id: string }>(opts, async ({ params, json, user, ip }) => {
  const c = await updateCollection(params.id, await json(collectionSchema));
  await logActivity({ user, ip, action: "collection.update", entityType: "Collection", entityId: c.id, summary: `Updated collection “${c.name}”` });
  return c;
});

export const DELETE = route<{ id: string }>(opts, async ({ params, user, ip }) => {
  const c = await deleteCollection(params.id);
  await logActivity({ user, ip, action: "collection.delete", entityType: "Collection", entityId: c.id, summary: `Deleted collection “${c.name}”` });
  return { deleted: true };
});
