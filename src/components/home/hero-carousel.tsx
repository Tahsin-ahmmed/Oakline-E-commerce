"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { SmartImage } from "@/components/shared/smart-image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BannerDTO } from "@/services/homepage";

const INTERVAL = 6500;

export function HeroCarousel({ banners }: { banners: BannerDTO[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const count = banners.length;
  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || paused || hovering) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = setTimeout(() => go(index + 1), INTERVAL);
    return () => clearTimeout(t);
  }, [index, paused, hovering, count, go]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured"
      className="relative"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
    >
      <div className="relative h-[78svh] max-h-[780px] min-h-[480px] overflow-hidden bg-muted">
        {banners.map((b, i) => (
          <div
            key={b.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            aria-hidden={i !== index}
            className={cn(
              "absolute inset-0 transition-opacity duration-1000 ease-out",
              i === index ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <SmartImage
              src={b.imageUrl}
              alt=""
              fill
              priority={i === 0}
              sizes="100vw"
              className={cn("object-cover transition-transform duration-[7000ms] ease-out", i === index ? "scale-105" : "scale-100", b.mobileImageUrl && "hidden sm:block")}
            />
            {b.mobileImageUrl && (
              <SmartImage src={b.mobileImageUrl} alt="" fill priority={i === 0} sizes="100vw" className="object-cover sm:hidden" />
            )}
            <div className="absolute inset-0 bg-black/30" />
            <div className="container-page relative flex h-full items-end pb-20 sm:items-center sm:pb-0">
              <div className="max-w-xl text-white">
                {b.eyebrow && <p className="text-[0.72rem] font-semibold tracking-[0.25em] uppercase text-white/85">{b.eyebrow}</p>}
                <h2 className="mt-4 font-heading text-4xl leading-[1.05] sm:text-6xl">{b.title}</h2>
                {b.subtitle && <p className="mt-5 max-w-md text-[0.98rem] leading-7 text-white/85">{b.subtitle}</p>}
                {b.ctaLabel && b.ctaHref && (
                  <Button asChild size="lg" className="mt-8 bg-white text-primary hover:bg-white/90" tabIndex={i === index ? 0 : -1}>
                    <Link href={b.ctaHref}>{b.ctaLabel}</Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {count > 1 && (
        <div className="container-page absolute inset-x-0 bottom-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className={cn("h-1 rounded-full bg-white/50 transition-all", i === index ? "w-10 bg-white" : "w-5 hover:bg-white/80")}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Play slideshow" : "Pause slideshow"}
              className="flex size-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/30"
            >
              {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
            </button>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous slide"
              className="flex size-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next slide"
              className="flex size-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
