"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Bold, ExternalLink, Heading2, Heading3, Italic, Link2, List, ListOrdered, Loader2, Minus, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field } from "@/components/shared/form-field";
import { Panel } from "@/components/admin/page-header";
import { ImageInput } from "@/components/admin/image-input";
import { api } from "@/lib/api-client";
import { slugify } from "@/lib/slug";
import { blogPostSchema, type BlogPostInput } from "@/lib/validations/admin/content";
import { localToIso, toLocalInput, useFormSubmit } from "@/components/admin/content/shared";
import { BlogCategoriesDialog, useBlogCategories, type BlogCategoryRow } from "@/components/admin/blog/blog-categories-dialog";

export interface EditablePost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImageUrl: string | null;
  categoryId: string | null;
  tags: string[];
  status: "DRAFT" | "PUBLISHED" | "SCHEDULED";
  publishedAt: Date | string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

type Snippet = { icon: typeof Bold; label: string; before: string; after: string; placeholder: string; block?: boolean };
const SNIPPETS: Snippet[] = [
  { icon: Heading2, label: "Heading", before: "<h2>", after: "</h2>", placeholder: "Section heading", block: true },
  { icon: Heading3, label: "Subheading", before: "<h3>", after: "</h3>", placeholder: "Subheading", block: true },
  { icon: Bold, label: "Bold", before: "<strong>", after: "</strong>", placeholder: "bold text" },
  { icon: Italic, label: "Italic", before: "<em>", after: "</em>", placeholder: "italic text" },
  { icon: Link2, label: "Link", before: '<a href="https://">', after: "</a>", placeholder: "link text" },
  { icon: List, label: "Bulleted list", before: "<ul>\n  <li>", after: "</li>\n  <li>Item</li>\n</ul>", placeholder: "Item", block: true },
  { icon: ListOrdered, label: "Numbered list", before: "<ol>\n  <li>", after: "</li>\n  <li>Item</li>\n</ol>", placeholder: "Item", block: true },
  { icon: Quote, label: "Quote", before: "<blockquote>", after: "</blockquote>", placeholder: "A memorable quote", block: true },
  { icon: Minus, label: "Divider", before: "<hr>", after: "", placeholder: "", block: true },
];

export function PostEditor({ post, categories }: { post: EditablePost | null; categories: BlogCategoryRow[] }) {
  const router = useRouter();
  const submit = useFormSubmit();
  const { data: cats = categories } = useBlogCategories(categories);
  const [tagsText, setTagsText] = useState(post?.tags.join(", ") ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(post));
  const [preview, setPreview] = useState<{ html: string; loading: boolean }>({ html: "", loading: false });
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const form = useForm<BlogPostInput>({
    resolver: zodResolver(blogPostSchema),
    defaultValues: {
      title: post?.title ?? "",
      slug: post?.slug ?? "",
      excerpt: post?.excerpt ?? "",
      content: post?.content ?? "",
      coverImageUrl: post?.coverImageUrl ?? "",
      categoryId: post?.categoryId ?? "",
      tags: post?.tags ?? [],
      status: post?.status ?? "DRAFT",
      publishedAt: toLocalInput(post?.publishedAt),
      seoTitle: post?.seoTitle ?? "",
      seoDescription: post?.seoDescription ?? "",
    },
  });
  const { register, control, handleSubmit, setValue, getValues, setError, formState } = form;
  const errors = formState.errors;
  const status = useWatch({ control, name: "status" });
  const contentReg = register("content");

  const insert = (s: Snippet) => {
    const el = textareaRef.current;
    const value = getValues("content");
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || s.placeholder;
    const pre = s.block && start > 0 && value[start - 1] !== "\n" ? "\n" : "";
    const text = `${pre}${s.before}${selected}${s.after}${s.block ? "\n" : ""}`;
    const next = value.slice(0, start) + text + value.slice(end);
    setValue("content", next, { shouldDirty: true, shouldValidate: formState.isSubmitted });
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const cursor = start + pre.length + s.before.length;
      el.setSelectionRange(cursor, cursor + selected.length);
    });
  };

  const loadPreview = async () => {
    setPreview((p) => ({ ...p, loading: true }));
    try {
      const res = await api<{ html: string }>("/api/admin/blog/preview", { body: { content: getValues("content") } });
      setPreview({ html: res.html, loading: false });
    } catch {
      setPreview({ html: "<p>Preview unavailable.</p>", loading: false });
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const body = { ...values, tags, publishedAt: localToIso(values.publishedAt) };
    const saved = await submit(
      () =>
        post
          ? api<{ id: string }>(`/api/admin/blog/posts/${post.id}`, { method: "PUT", body })
          : api<{ id: string }>("/api/admin/blog/posts", { body }),
      post ? "Post saved" : "Post created",
      setError,
    );
    if (saved && !post) router.push(`/admin/blog/${saved.id}`);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="grid min-w-0 content-start gap-6">
        <Panel>
          <div className="grid gap-4">
            <Field label="Title" htmlFor="p-title" error={errors.title?.message} required>
              <Input
                id="p-title"
                {...register("title", {
                  onChange: (e) => {
                    if (!slugTouched) setValue("slug", slugify(e.target.value));
                  },
                })}
                className="h-11 text-base"
              />
            </Field>
            <Field label="Slug" htmlFor="p-slug" error={errors.slug?.message} hint="URL: /blog/your-slug">
              <Input id="p-slug" {...register("slug", { onChange: () => setSlugTouched(true) })} />
            </Field>
            <Field label="Excerpt" htmlFor="p-excerpt" error={errors.excerpt?.message} hint="Shown on the blog index and in search results">
              <Textarea id="p-excerpt" rows={2} {...register("excerpt")} />
            </Field>
          </div>
        </Panel>
        <Panel title="Content" description="Write in HTML or plain paragraphs. Unsafe markup is removed when saved.">
          <Tabs defaultValue="write" onValueChange={(v) => v === "preview" && loadPreview()}>
            <TabsList>
              <TabsTrigger value="write">Write</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            <TabsContent value="write" className="mt-3 grid gap-2">
              <div className="flex flex-wrap gap-1 rounded-md border bg-muted/40 p-1" role="toolbar" aria-label="Formatting">
                {SNIPPETS.map((s) => (
                  <Button key={s.label} type="button" variant="ghost" size="icon-sm" onClick={() => insert(s)} aria-label={s.label} title={s.label}>
                    <s.icon />
                  </Button>
                ))}
              </div>
              <Field error={errors.content?.message}>
                <Textarea
                  {...contentReg}
                  ref={(el) => {
                    contentReg.ref(el);
                    textareaRef.current = el;
                  }}
                  rows={22}
                  className="field-sizing-fixed font-mono text-[0.82rem] leading-6"
                  aria-label="Post content"
                />
              </Field>
            </TabsContent>
            <TabsContent value="preview" className="mt-3">
              <div className="min-h-64 rounded-md border bg-background p-6">
                {preview.loading ? (
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                ) : (
                  <div className="prose-oak" dangerouslySetInnerHTML={{ __html: preview.html }} />
                )}
              </div>
            </TabsContent>
          </Tabs>
        </Panel>
        <Panel title="Search engine listing">
          <div className="grid gap-4">
            <Field label="SEO title" htmlFor="p-seo-title" error={errors.seoTitle?.message} hint="Defaults to the post title">
              <Input id="p-seo-title" {...register("seoTitle")} />
            </Field>
            <Field label="SEO description" htmlFor="p-seo-desc" error={errors.seoDescription?.message} hint="Defaults to the excerpt">
              <Textarea id="p-seo-desc" rows={2} {...register("seoDescription")} />
            </Field>
          </div>
        </Panel>
      </div>

      <div className="grid content-start gap-6">
        <Panel title="Publishing">
          <div className="grid gap-4">
            <Field label="Status" error={errors.status?.message}>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="PUBLISHED">Published</SelectItem>
                      <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field
              label={status === "SCHEDULED" ? "Publish on" : "Publish date"}
              htmlFor="p-date"
              error={errors.publishedAt?.message}
              hint={status === "PUBLISHED" ? "Leave blank to publish now" : status === "SCHEDULED" ? "Goes live automatically at this time" : undefined}
            >
              <Input id="p-date" type="datetime-local" {...register("publishedAt")} />
            </Field>
            <Button type="submit" disabled={formState.isSubmitting}>
              {formState.isSubmitting && <Loader2 className="animate-spin" />}
              {post ? "Save post" : "Create post"}
            </Button>
            {post && post.status !== "DRAFT" && (
              <Button variant="outline" asChild>
                <Link href={`/blog/${post.slug}`} target="_blank">
                  <ExternalLink /> View on site
                </Link>
              </Button>
            )}
          </div>
        </Panel>
        <Panel title="Organisation">
          <div className="grid gap-4">
            <Field label="Category" error={errors.categoryId?.message}>
              <div className="flex gap-2">
                <Controller
                  control={control}
                  name="categoryId"
                  render={({ field }) => (
                    <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Uncategorised</SelectItem>
                        {cats.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <BlogCategoriesDialog
                  trigger={
                    <Button type="button" variant="outline" size="icon" aria-label="Manage categories">
                      <List />
                    </Button>
                  }
                />
              </div>
            </Field>
            <Field label="Tags" htmlFor="p-tags" hint="Comma separated, e.g. style, care">
              <Input id="p-tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
            </Field>
          </div>
        </Panel>
        <Panel title="Cover image">
          <Controller
            control={control}
            name="coverImageUrl"
            render={({ field }) => <ImageInput value={field.value} onChange={field.onChange} folder="blog" aspect="aspect-[16/10]" />}
          />
          {errors.coverImageUrl?.message && <p className="mt-2 text-xs text-destructive">{errors.coverImageUrl.message}</p>}
        </Panel>
      </div>
    </form>
  );
}
