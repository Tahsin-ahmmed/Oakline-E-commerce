import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/page-header";
import { PostEditor } from "@/components/admin/blog/post-editor";
import { listBlogCategories } from "@/services/admin/blog";

export const metadata: Metadata = { title: "Edit post" };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff("content.manage", `/admin/blog/${id}`);
  const [post, categories] = await Promise.all([
    prisma.blogPost.findFirst({ where: { id, deletedAt: null } }),
    listBlogCategories(),
  ]);
  if (!post) notFound();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Edit post" description={post.title} />
      <PostEditor post={post} categories={categories} />
    </div>
  );
}
