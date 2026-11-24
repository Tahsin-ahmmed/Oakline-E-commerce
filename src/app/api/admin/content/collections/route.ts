import { route } from "@/lib/api";
import { collectionSchema } from "@/lib/validations/admin/content";
import { createCollection, listCollections } from "@/services/admin/content";
import { logActivity } from "@/services/audit";

const opts = { auth: "staff", permission: "content.manage" } as const;

export const GET = route(opts, async () => listCollections());

export const POST = route(opts, async ({ json, user, ip }) => {
  const c = await createCollection(await json(collectionSchema));
  await logActivity({ user, ip, action: "collection.create", entityType: "Collection", entityId: c.id, summary: `Created collection “${c.name}”` });
  return c;
});
