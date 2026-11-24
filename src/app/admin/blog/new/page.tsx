import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/page-header";
import { PostEditor } from "@/components/admin/blog/post-editor";
import { listBlogCategories } from "@/services/admin/blog";

export const metadata: Metadata = { title: "New post" };

export default async function NewPostPage() {
  await requireStaff("content.manage", "/admin/blog/new");
  const categories = await listBlogCategories();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="New post" />
      <PostEditor post={null} categories={categories} />
    </div>
  );
}
