import { route } from "@/lib/api";
import { blogCategorySchema } from "@/lib/validations/admin/content";
import { deleteBlogCategory, renameBlogCategory } from "@/services/admin/blog";
import { logActivity } from "@/services/audit";

const opts = { auth: "staff", permission: "content.manage" } as const;

export const PATCH = route<{ id: string }>(opts, async ({ params, json, user, ip }) => {
  const { name } = await json(blogCategorySchema);
  const c = await renameBlogCategory(params.id, name);
  await logActivity({ user, ip, action: "blog.category.update", entityType: "BlogCategory", entityId: c.id, summary: `Renamed blog category to “${c.name}”` });
  return c;
});

export const DELETE = route<{ id: string }>(opts, async ({ params, user, ip }) => {
  const c = await deleteBlogCategory(params.id);
  await logActivity({ user, ip, action: "blog.category.delete", entityType: "BlogCategory", entityId: c.id, summary: `Deleted blog category “${c.name}”` });
  return { deleted: true };
});
