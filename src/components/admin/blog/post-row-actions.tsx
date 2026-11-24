"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { api, errorMessage } from "@/lib/api-client";

export function PostRowActions({ id, title, slug, live }: { id: string; title: string; slug: string; live: boolean }) {
  const router = useRouter();
  return (
    <div className="flex justify-end gap-1">
      {live && (
        <Button variant="ghost" size="icon-sm" asChild aria-label={`View ${title}`}>
          <Link href={`/blog/${slug}`} target="_blank">
            <ExternalLink />
          </Link>
        </Button>
      )}
      <Button variant="ghost" size="icon-sm" asChild aria-label={`Edit ${title}`}>
        <Link href={`/admin/blog/${id}`}>
          <Pencil />
        </Link>
      </Button>
      <ConfirmDialog
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={`Delete ${title}`}>
            <Trash2 className="text-destructive" />
          </Button>
        }
        title="Delete this post?"
        description={`“${title}” will be removed from the blog.`}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          try {
            await api(`/api/admin/blog/posts/${id}`, { method: "DELETE" });
            toast.success("Post deleted");
            router.refresh();
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </div>
  );
}
