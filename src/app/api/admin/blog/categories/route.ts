import { route } from "@/lib/api";
import { blogCategorySchema } from "@/lib/validations/admin/content";
import { createBlogCategory, listBlogCategories } from "@/services/admin/blog";
import { logActivity } from "@/services/audit";

const opts = { auth: "staff", permission: "content.manage" } as const;

export const GET = route(opts, async () => listBlogCategories());

export const POST = route(opts, async ({ json, user, ip }) => {
  const { name } = await json(blogCategorySchema);
  const c = await createBlogCategory(name);
  await logActivity({ user, ip, action: "blog.category.create", entityType: "BlogCategory", entityId: c.id, summary: `Created blog category “${c.name}”` });
  return c;
});
