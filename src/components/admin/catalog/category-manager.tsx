"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { ArrowDown, ArrowUp, FolderTree, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/shared/form-field";
import { ActiveBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ImageInput } from "@/components/admin/image-input";
import { ControlledConfirm } from "@/components/admin/catalog/products-table";
import { ApiClientError, api, errorMessage } from "@/lib/api-client";
import { slugify } from "@/lib/slug";
import { categorySchema } from "@/lib/validations/admin/catalog";
import type { CategoryTreeNode } from "@/services/admin/categories";

type Node = Omit<CategoryTreeNode, "children" | "totalProducts"> & { children?: Node[]; totalProducts?: number };

interface FormValues {
  name: string;
  slug: string;
  parentId: string;
  description: string;
  imageUrl: string;
  sortOrder: string;
  isActive: boolean;
  seoTitle: string;
  seoDescription: string;
}

export function CategoryManager({ tree }: { tree: CategoryTreeNode[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ node: Node | null; parentId: string | null } | null>(null);
  const [deleting, setDeleting] = useState<Node | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (key: string, fn: () => Promise<unknown>, msg: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(msg);
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const row = (node: Node, depth: number, index: number, siblings: number) => (
    <div key={node.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-0" style={{ paddingLeft: 16 + depth * 32 }}>
      <div className="size-10 shrink-0 overflow-hidden rounded-md border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {node.imageUrl && <img src={node.imageUrl} alt="" className="size-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className={depth === 0 ? "font-medium" : "text-sm"}>{node.name}</p>
        <p className="text-xs text-muted-foreground">
          /{node.slug} · {depth === 0 && node.totalProducts !== undefined ? `${node.totalProducts} products total` : `${node.productCount} products`}
          {depth === 0 && node.children?.length ? ` · ${node.children.length} subcategories` : ""}
        </p>
      </div>
      <div className="hidden sm:block">
        <ActiveBadge active={node.isActive} on="Visible" off="Hidden" />
      </div>
      <Switch
        checked={node.isActive}
        disabled={busy === `a-${node.id}`}
        onCheckedChange={(v) => act(`a-${node.id}`, () => api(`/api/admin/categories/${node.id}`, { method: "PATCH", body: { isActive: v } }), v ? "Category visible" : "Category hidden")}
        aria-label={`Toggle ${node.name} visibility`}
      />
      <div className="flex">
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={index === 0 || busy !== null}
          onClick={() => act(`m-${node.id}`, () => api(`/api/admin/categories/${node.id}`, { method: "PATCH", body: { move: "up" } }), "Order updated")}
          aria-label="Move up"
        >
          <ArrowUp />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={index === siblings - 1 || busy !== null}
          onClick={() => act(`m-${node.id}`, () => api(`/api/admin/categories/${node.id}`, { method: "PATCH", body: { move: "down" } }), "Order updated")}
          aria-label="Move down"
        >
          <ArrowDown />
        </Button>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${node.name}`}>
            {busy?.endsWith(node.id) ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing({ node, parentId: node.parentId })}>
            <Pencil /> Edit
          </DropdownMenuItem>
          {depth === 0 && (
            <DropdownMenuItem onSelect={() => setEditing({ node: null, parentId: node.id })}>
              <Plus /> Add subcategory
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(node)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing({ node: null, parentId: null })}>
          <Plus /> Add category
        </Button>
      </div>
      {tree.length === 0 ? (
        <EmptyState icon={FolderTree} title="No categories yet" description="Create a category to start organising products." />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-soft)]">
          {tree.map((parent, i) => (
            <div key={parent.id} className="border-b last:border-0">
              {row(parent, 0, i, tree.length)}
              {parent.children.map((child, j) => row(child, 1, j, parent.children.length))}
            </div>
          ))}
        </div>
      )}
      {editing && (
        <CategoryDialog
          tree={tree}
          node={editing.node}
          parentId={editing.parentId}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
      <DeleteCategoryDialog tree={tree} node={deleting} onClose={() => setDeleting(null)} onDone={() => router.refresh()} />
    </>
  );
}

function CategoryDialog({
  tree,
  node,
  parentId,
  onClose,
  onSaved,
}: {
  tree: CategoryTreeNode[];
  node: Node | null;
  parentId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [slugTouched, setSlugTouched] = useState(Boolean(node));
  const { register, handleSubmit, control, setValue, setError, formState } = useForm<FormValues>({
    defaultValues: {
      name: node?.name ?? "",
      slug: node?.slug ?? "",
      parentId: parentId ?? "",
      description: node?.description ?? "",
      imageUrl: node?.imageUrl ?? "",
      sortOrder: String(node?.sortOrder ?? 0),
      isActive: node?.isActive ?? true,
      seoTitle: node?.seoTitle ?? "",
      seoDescription: node?.seoDescription ?? "",
    },
  });
  const { errors, isSubmitting } = formState;
  const hasChildren = Boolean(node?.children?.length);
  const parents = tree.filter((t) => t.id !== node?.id);

  const submit = handleSubmit(async (v) => {
    const payload = {
      name: v.name,
      slug: v.slug,
      parentId: v.parentId || null,
      description: v.description || null,
      imageUrl: v.imageUrl || null,
      sortOrder: Number(v.sortOrder || 0),
      isActive: v.isActive,
      seoTitle: v.seoTitle || null,
      seoDescription: v.seoDescription || null,
    };
    const parsed = categorySchema.safeParse(payload);
    if (!parsed.success) {
      for (const i of parsed.error.issues) setError(i.path.join(".") as keyof FormValues, { message: i.message });
      return;
    }
    try {
      if (node) await api(`/api/admin/categories/${node.id}`, { method: "PUT", body: parsed.data });
      else await api("/api/admin/categories", { body: parsed.data });
      toast.success(node ? "Category updated" : "Category created");
      onSaved();
    } catch (e) {
      if (e instanceof ApiClientError && e.details) {
        for (const [k, m] of Object.entries(e.details)) {
          if (Array.isArray(m) && typeof m[0] === "string") setError(k as keyof FormValues, { message: m[0] });
        }
      }
      toast.error(errorMessage(e));
    }
  });

  return (
    <Dialog open onOpenChange={(o) => !o && !isSubmitting && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{node ? `Edit ${node.name}` : parentId ? "New subcategory" : "New category"}</DialogTitle>
          <DialogDescription>Categories organise the storefront navigation and filters.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="c-name" error={errors.name?.message} required>
              <Input
                id="c-name"
                {...register("name", { onChange: (e) => !slugTouched && setValue("slug", slugify(e.target.value)) })}
              />
            </Field>
            <Field label="Slug" htmlFor="c-slug" error={errors.slug?.message} required>
              <Input id="c-slug" {...register("slug", { onChange: () => setSlugTouched(true) })} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="parentId"
              render={({ field }) => (
                <Field label="Parent" htmlFor="c-parent" error={errors.parentId?.message} hint={hasChildren ? "Has subcategories, so it stays top-level." : undefined}>
                  <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)} disabled={hasChildren}>
                    <SelectTrigger id="c-parent" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (top-level)</SelectItem>
                      {parents.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
            <Field label="Display order" htmlFor="c-sort" error={errors.sortOrder?.message} hint="Lower numbers come first">
              <Input id="c-sort" type="number" min="0" {...register("sortOrder")} />
            </Field>
          </div>
          <Field label="Description" htmlFor="c-desc" error={errors.description?.message}>
            <Textarea id="c-desc" rows={2} {...register("description")} />
          </Field>
          <Controller
            control={control}
            name="imageUrl"
            render={({ field }) => (
              <Field label="Image" error={errors.imageUrl?.message}>
                <ImageInput value={field.value} onChange={field.onChange} folder="categories" aspect="aspect-[3/2]" />
              </Field>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SEO title" htmlFor="c-seot" error={errors.seoTitle?.message}>
              <Input id="c-seot" {...register("seoTitle")} />
            </Field>
            <Field label="SEO description" htmlFor="c-seod" error={errors.seoDescription?.message}>
              <Input id="c-seod" {...register("seoDescription")} />
            </Field>
          </div>
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <label className="flex items-center gap-3 text-sm">
                <Switch checked={field.value} onCheckedChange={field.onChange} /> Visible in the store
              </label>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {node ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteCategoryDialog({
  tree,
  node,
  onClose,
  onDone,
}: {
  tree: CategoryTreeNode[];
  node: Node | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [moveTo, setMoveTo] = useState("");
  const blocked = node ? node.productCount > 0 || Boolean(node.children?.length) : false;
  const hasChildren = Boolean(node?.children?.length);
  // Targets: anything except itself and its own children; when it has children, only top-level targets.
  const targets = tree
    .flatMap((p) => [{ id: p.id, name: p.name, top: true }, ...p.children.map((c) => ({ id: c.id, name: `${p.name} › ${c.name}`, top: false }))])
    .filter((t) => t.id !== node?.id && !node?.children?.some((c) => c.id === t.id) && (!hasChildren || t.top));

  return (
    <ControlledConfirm
      open={Boolean(node)}
      onOpenChange={(o) => {
        if (!o) {
          setMoveTo("");
          onClose();
        }
      }}
      title={`Delete “${node?.name ?? ""}”?`}
      destructive
      confirmLabel={blocked ? "Move & delete" : "Delete"}
      description={
        blocked ? (
          <span className="block space-y-3">
            <span className="block">
              This category has {node?.productCount ?? 0} product(s){hasChildren ? ` and ${node?.children?.length} subcategory(ies)` : ""}. Choose where to move
              them before deleting.
            </span>
            <Select value={moveTo} onValueChange={setMoveTo}>
              <SelectTrigger className="w-full" aria-label="Move to category">
                <SelectValue placeholder="Move to…" />
              </SelectTrigger>
              <SelectContent>
                {targets.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </span>
        ) : (
          "This cannot be undone."
        )
      }
      onConfirm={async () => {
        if (!node) return;
        if (blocked && !moveTo) {
          toast.error("Choose a category to move the products to.");
          throw new Error("no target");
        }
        try {
          await api(`/api/admin/categories/${node.id}${moveTo ? `?moveToId=${encodeURIComponent(moveTo)}` : ""}`, { method: "DELETE" });
          toast.success("Category deleted");
          setMoveTo("");
          onDone();
        } catch (e) {
          toast.error(errorMessage(e));
          throw e;
        }
      }}
    />
  );
}
