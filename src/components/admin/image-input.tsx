"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ImagePlus, Link2, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, errorMessage, uploadFile } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type Folder = "products" | "categories" | "banners" | "blog" | "brands" | "branding" | "collections";
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
const MAX = 5 * 1024 * 1024;

function useUploadsEnabled() {
  return useQuery({
    queryKey: ["uploads-enabled"],
    queryFn: () => api<{ enabled: boolean }>("/api/admin/uploads"),
    staleTime: 5 * 60_000,
  });
}

function isHttpUrl(v: string) {
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function UrlAdder({ onAdd, compact }: { onAdd: (url: string) => void; compact?: boolean }) {
  const [url, setUrl] = useState("");
  return (
    <div className="flex gap-2">
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://… paste an image URL"
        className={cn(compact && "h-9")}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (isHttpUrl(url)) {
              onAdd(url.trim());
              setUrl("");
            }
          }
        }}
      />
      <Button
        type="button"
        variant="outline"
        disabled={!isHttpUrl(url)}
        onClick={() => {
          onAdd(url.trim());
          setUrl("");
        }}
      >
        <Link2 /> Add
      </Button>
    </div>
  );
}

async function doUpload(files: FileList | null, folder: Folder) {
  const out: string[] = [];
  for (const file of Array.from(files ?? [])) {
    if (!ACCEPT.split(",").includes(file.type)) {
      toast.error(`${file.name}: only JPEG, PNG, WebP or AVIF images are allowed.`);
      continue;
    }
    if (file.size > MAX) {
      toast.error(`${file.name} is larger than 5 MB.`);
      continue;
    }
    try {
      const res = await uploadFile(file, folder);
      out.push(res.url);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  return out;
}

/** Single image field (category image, banner, blog cover…). */
export function ImageInput({
  value,
  onChange,
  folder,
  aspect = "aspect-[16/9]",
}: {
  value: string | null | undefined;
  onChange: (url: string) => void;
  folder: Folder;
  aspect?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const enabled = useUploadsEnabled().data?.enabled;
  return (
    <div className="grid gap-3">
      {value ? (
        <div className={cn("relative overflow-hidden rounded-lg border bg-muted", aspect)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="size-full object-cover" />
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            className="absolute top-2 right-2 shadow"
            onClick={() => onChange("")}
            aria-label="Remove image"
          >
            <X />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!enabled || busy}
          onClick={() => fileRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/50 text-sm text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed",
            aspect,
          )}
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
          {enabled ? "Upload image (max 5 MB)" : "Uploads not configured — paste a URL below"}
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={async (e) => {
          setBusy(true);
          const [url] = await doUpload(e.target.files, folder);
          setBusy(false);
          e.target.value = "";
          if (url) onChange(url);
        }}
      />
      <UrlAdder compact onAdd={onChange} />
    </div>
  );
}

export interface GalleryImage {
  url: string;
  alt?: string | null;
}

/** Ordered multi-image manager for product galleries. */
export function ImageListInput({
  value,
  onChange,
  folder,
  max = 10,
}: {
  value: GalleryImage[];
  onChange: (images: GalleryImage[]) => void;
  folder: Folder;
  max?: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const enabled = useUploadsEnabled().data?.enabled;
  const move = (i: number, dir: -1 | 1) => {
    const next = [...value];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {value.map((img, i) => (
          <div key={`${img.url}-${i}`} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.alt ?? ""} className="size-full object-cover" />
            {i === 0 && (
              <span className="absolute top-2 left-2 rounded bg-background/90 px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide uppercase">
                Cover
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-black/50 p-1.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
              <div className="flex gap-1">
                <Button type="button" size="icon-xs" variant="secondary" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move left">
                  <ArrowUp className="-rotate-90" />
                </Button>
                <Button type="button" size="icon-xs" variant="secondary" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label="Move right">
                  <ArrowDown className="-rotate-90" />
                </Button>
              </div>
              <Button
                type="button"
                size="icon-xs"
                variant="secondary"
                onClick={() => onChange(value.filter((_, k) => k !== i))}
                aria-label="Remove image"
              >
                <Trash2 />
              </Button>
            </div>
          </div>
        ))}
        {value.length < max && (
          <button
            type="button"
            disabled={!enabled || busy}
            onClick={() => fileRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/40 p-3 text-center text-xs text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
            {enabled ? "Upload images" : "Uploads not configured"}
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={async (e) => {
          setBusy(true);
          const urls = await doUpload(e.target.files, folder);
          setBusy(false);
          e.target.value = "";
          if (urls.length) onChange([...value, ...urls.map((url) => ({ url }))].slice(0, max));
        }}
      />
      {value.length < max && <UrlAdder onAdd={(url) => onChange([...value, { url }])} />}
    </div>
  );
}
