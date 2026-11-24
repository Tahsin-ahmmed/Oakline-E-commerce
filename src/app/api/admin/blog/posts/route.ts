import { z } from "zod";
import { route } from "@/lib/api";
import { blogPostSchema, POST_STATUSES } from "@/lib/validations/admin/content";
import { createPost, listPostsAdmin } from "@/services/admin/blog";
import { logActivity } from "@/services/audit";

const opts = { auth: "staff", permission: "content.manage" } as const;

export const GET = route(opts, async ({ query }) => {
  const q = query(
    z.object({
      q: z.string().trim().max(100).optional(),
      status: z.enum(POST_STATUSES).optional(),
      page: z.coerce.number().int().min(1).max(1000).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
    }),
  );
  const res = await listPostsAdmin({ q: q.q, status: q.status, skip: (q.page - 1) * q.pageSize, take: q.pageSize });
  return { ...res, page: q.page, pageSize: q.pageSize };
});

export const POST = route(opts, async ({ json, user, ip }) => {
  const post = await createPost(await json(blogPostSchema), user!.id);
  await logActivity({ user, ip, action: "blog.create", entityType: "BlogPost", entityId: post.id, summary: `Created post “${post.title}” (${post.status})` });
  return post;
});
