"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { SmartImage } from "@/components/shared/smart-image";
import { cn } from "@/lib/utils";

export interface GalleryImage {
  id: string;
  url: string;
  alt: string;
}

export function ProductGallery({ images, activeUrl, name }: { images: GalleryImage[]; activeUrl?: string | null; name: string }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const [override, setOverride] = useState<string | null>(null);
  const [lastActive, setLastActive] = useState<string | null | undefined>(activeUrl);

  // Switch to the variant's image when the selected variant changes (state adjusted during render).
  if (activeUrl !== lastActive) {
    setLastActive(activeUrl);
    if (activeUrl) {
      const i = images.findIndex((img) => img.url === activeUrl);
      if (i >= 0) {
        setIndex(i);
        setOverride(null);
      } else setOverride(activeUrl);
    }
  }

  const extra = override;
  const current = extra ? { id: "variant", url: extra, alt: name } : images[index];
  const count = images.length;
  const go = (d: number) => {
    setOverride(null);
    setIndex((i) => (((i + d) % count) + count) % count);
  };

  if (!current) {
    return <div className="flex aspect-[4/5] items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">No image available</div>;
  }

  return (
    <div className="flex flex-col-reverse gap-4 md:flex-row">
      {count > 1 && (
        <div className="flex gap-3 overflow-x-auto md:w-20 md:flex-col md:overflow-visible" role="tablist" aria-label="Product images">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              role="tab"
              aria-selected={!extra && i === index}
              aria-label={`Show image ${i + 1}`}
              onClick={() => {
                setOverride(null);
                setIndex(i);
              }}
              className={cn(
                "relative aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-md border-2 bg-muted transition md:w-full",
                !extra && i === index ? "border-foreground" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <SmartImage src={img.url} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="relative flex-1">
        <div
          className="group relative aspect-[4/5] cursor-zoom-in overflow-hidden rounded-lg bg-muted"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
          }}
          onMouseLeave={() => setZoom(null)}
          onClick={() => setFullscreen(true)}
        >
          <SmartImage
            key={current.url}
            src={current.url}
            alt={current.alt}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 55vw"
            className="object-cover transition-transform duration-200 ease-out"
            style={zoom ? { transform: "scale(2)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setFullscreen(true);
            }}
            className="absolute right-4 bottom-4 flex size-10 items-center justify-center rounded-full bg-card/90 shadow-sm backdrop-blur transition hover:bg-card"
            aria-label="Open full-screen image viewer"
          >
            <Expand className="size-4" />
          </button>
          {count > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  go(-1);
                }}
                className="absolute top-1/2 left-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 opacity-0 shadow-sm transition group-hover:opacity-100 focus:opacity-100 max-md:opacity-100"
                aria-label="Previous image"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  go(1);
                }}
                className="absolute top-1/2 right-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 opacity-0 shadow-sm transition group-hover:opacity-100 focus:opacity-100 max-md:opacity-100"
                aria-label="Next image"
              >
                <ChevronRight className="size-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-[min(96vw,1100px)] bg-background p-2 sm:max-w-[min(96vw,1100px)]">
          <DialogTitle className="sr-only">{name} — image viewer</DialogTitle>
          <div className="relative h-[82dvh] w-full overflow-auto">
            <SmartImage src={current.url} alt={current.alt} fill sizes="96vw" className="object-contain" />
          </div>
          {count > 1 && (
            <div className="flex items-center justify-center gap-3 pb-2">
              <button type="button" onClick={() => go(-1)} className="flex size-10 items-center justify-center rounded-full border bg-card" aria-label="Previous image">
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-sm text-muted-foreground tabular-nums">
                {index + 1} / {count}
              </span>
              <button type="button" onClick={() => go(1)} className="flex size-10 items-center justify-center rounded-full border bg-card" aria-label="Next image">
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
