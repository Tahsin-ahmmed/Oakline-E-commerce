"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Pencil, Plus, Settings2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { api, errorMessage } from "@/lib/api-client";

export interface BlogCategoryRow {
  id: string;
  name: string;
  slug: string;
  _count: { posts: number };
}

export const BLOG_CATEGORIES_KEY = ["admin-blog-categories"] as const;

export function useBlogCategories(initial?: BlogCategoryRow[]) {
  return useQuery({
    queryKey: BLOG_CATEGORIES_KEY,
    queryFn: () => api<BlogCategoryRow[]>("/api/admin/blog/categories"),
    initialData: initial,
  });
}

/** Inline create / rename / delete of blog categories. */
export function BlogCategoriesDialog({ trigger }: { trigger?: React.ReactNode }) {
  const qc = useQueryClient();
  const router = useRouter();
  const { data: categories = [], isLoading } = useBlogCategories();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(msg);
      await qc.invalidateQueries({ queryKey: BLOG_CATEGORIES_KEY });
      router.refresh();
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline">
            <Settings2 /> Categories
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Blog categories</DialogTitle>
          <DialogDescription>Deleting a category keeps its posts, just uncategorised.</DialogDescription>
        </DialogHeader>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (name.trim().length < 2) return;
            if (await act(() => api("/api/admin/blog/categories", { body: { name: name.trim() } }), "Category created")) setName("");
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category name" aria-label="New category name" />
          <Button type="submit" disabled={busy || name.trim().length < 2}>
            <Plus /> Add
          </Button>
        </form>
        <ul className="max-h-72 divide-y overflow-y-auto rounded-md border">
          {isLoading && (
            <li className="flex justify-center p-4">
              <Loader2 className="size-4 animate-spin" />
            </li>
          )}
          {!isLoading && categories.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">No categories yet.</li>}
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-2 px-3 py-2">
              {editing?.id === c.id ? (
                <>
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                    className="h-8"
                    aria-label="Category name"
                    autoFocus
                  />
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Save"
                    disabled={busy}
                    onClick={async () => {
                      if (await act(() => api(`/api/admin/blog/categories/${c.id}`, { method: "PATCH", body: { name: editing.name.trim() } }), "Category renamed"))
                        setEditing(null);
                    }}
                  >
                    <Check />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label="Cancel" onClick={() => setEditing(null)}>
                    <X />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">
                    {c.name} <span className="text-xs text-muted-foreground">· {c._count.posts} posts</span>
                  </span>
                  <Button size="icon-sm" variant="ghost" aria-label={`Rename ${c.name}`} onClick={() => setEditing({ id: c.id, name: c.name })}>
                    <Pencil />
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button size="icon-sm" variant="ghost" aria-label={`Delete ${c.name}`}>
                        <Trash2 className="text-destructive" />
                      </Button>
                    }
                    title={`Delete “${c.name}”?`}
                    description={c._count.posts ? `${c._count.posts} posts will become uncategorised.` : undefined}
                    confirmLabel="Delete"
                    destructive
                    onConfirm={() => act(() => api(`/api/admin/blog/categories/${c.id}`, { method: "DELETE" }), "Category deleted")}
                  />
                </>
              )}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
