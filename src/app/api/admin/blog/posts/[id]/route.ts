import { route } from "@/lib/api";
import { blogPostSchema } from "@/lib/validations/admin/content";
import { getPostAdmin, softDeletePost, updatePost } from "@/services/admin/blog";
import { logActivity } from "@/services/audit";

const opts = { auth: "staff", permission: "content.manage" } as const;

export const GET = route<{ id: string }>(opts, async ({ params }) => getPostAdmin(params.id));

export const PUT = route<{ id: string }>(opts, async ({ params, json, user, ip }) => {
  const post = await updatePost(params.id, await json(blogPostSchema));
  await logActivity({ user, ip, action: "blog.update", entityType: "BlogPost", entityId: post.id, summary: `Updated post “${post.title}” (${post.status})` });
  return post;
});

export const DELETE = route<{ id: string }>(opts, async ({ params, user, ip }) => {
  const post = await softDeletePost(params.id);
  await logActivity({ user, ip, action: "blog.delete", entityType: "BlogPost", entityId: post.id, summary: `Deleted post “${post.title}”` });
  return { deleted: true };
});
