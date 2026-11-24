import Link from "next/link";
import { ArrowRight, Camera, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SmartImage } from "@/components/shared/smart-image";
import { RatingStars } from "@/components/shared/rating-stars";
import { ProductGrid } from "@/components/products/product-card";
import { NewsletterForm } from "@/components/layout/newsletter-form";
import type { BannerDTO, HomeSection } from "@/services/homepage";

type Of<T extends HomeSection["type"]> = Extract<HomeSection, { type: T }>;

export function SectionHeading({
  title,
  subtitle,
  href,
  linkLabel = "View all",
}: {
  title: string;
  subtitle?: string | null;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="font-heading text-3xl sm:text-[2.4rem] sm:leading-tight">{title}</h2>
        {subtitle && <p className="mt-2 max-w-xl text-[0.95rem] text-muted-foreground">{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className="group inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline">
          {linkLabel} <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

export function CategoriesSection({ section }: { section: Of<"categories"> }) {
  return (
    <section className="container-page py-20">
      <SectionHeading title={section.title} subtitle={section.subtitle} href="/products" linkLabel="Shop everything" />
      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
        {section.categories.map((c, i) => (
          <Link
            key={c.id}
            href={`/categories/${c.slug}`}
            className={`group relative overflow-hidden rounded-lg bg-muted ${i === 0 ? "row-span-2 aspect-[4/5] lg:aspect-auto" : "aspect-[4/3]"}`}
          >
            {c.imageUrl && (
              <SmartImage
                src={c.imageUrl}
                alt=""
                fill
                sizes="(max-width:1024px) 50vw, 33vw"
                className="object-cover transition duration-700 group-hover:scale-[1.04]"
              />
            )}
            <div className="absolute inset-0 bg-black/20 transition group-hover:bg-black/30" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5 text-white">
              <div>
                <h3 className="font-heading text-xl sm:text-2xl">{c.name}</h3>
                {c.description && i === 0 && <p className="mt-1 hidden max-w-xs text-sm text-white/85 sm:block">{c.description}</p>}
              </div>
              <span className="flex size-9 items-center justify-center rounded-full bg-white/90 text-primary transition group-hover:bg-white">
                <ArrowRight className="size-4" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function ProductsSection({ section, priority }: { section: Of<"products">; priority?: boolean }) {
  return (
    <section className="container-page py-16">
      <SectionHeading title={section.title} subtitle={section.subtitle} href={section.href} />
      <ProductGrid products={section.products} priorityCount={priority ? 4 : 0} />
    </section>
  );
}

function PromoCard({ banner }: { banner: BannerDTO }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-muted">
      <div className="relative aspect-[4/5] sm:aspect-[21/9]">
        <SmartImage src={banner.imageUrl} alt="" fill sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-black/35" />
      </div>
      <div className="absolute inset-0 flex items-center p-8 sm:p-14">
        <div className="max-w-lg text-white">
          {banner.eyebrow && <p className="text-[0.72rem] font-semibold tracking-[0.25em] uppercase text-white/85">{banner.eyebrow}</p>}
          <h2 className="mt-3 font-heading text-3xl leading-tight sm:text-5xl">{banner.title}</h2>
          {banner.subtitle && <p className="mt-4 text-white/85">{banner.subtitle}</p>}
          {banner.ctaLabel && banner.ctaHref && (
            <Button asChild size="lg" className="mt-7 bg-white text-primary hover:bg-white/90">
              <Link href={banner.ctaHref}>{banner.ctaLabel}</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function PromoSection({ section }: { section: Of<"promo"> }) {
  return (
    <section className="container-page grid gap-6 py-12">
      {section.banners.map((b) => (
        <PromoCard key={b.id} banner={b} />
      ))}
    </section>
  );
}

export function CollectionsSection({ section }: { section: Of<"collections"> }) {
  return (
    <section className="bg-secondary/50 py-20">
      <div className="container-page">
        <SectionHeading title={section.title} subtitle={section.subtitle} />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {section.collections.map((c) => (
            <Link key={c.id} href={`/collections/${c.slug}`} className="group">
              <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-muted">
                {c.imageUrl && (
                  <SmartImage
                    src={c.imageUrl}
                    alt=""
                    fill
                    sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 25vw"
                    className="object-cover transition duration-700 group-hover:scale-[1.04]"
                  />
                )}
              </div>
              <h3 className="mt-4 font-heading text-xl">{c.name}</h3>
              {c.description && <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>}
              <p className="mt-2 inline-flex items-center gap-1 text-sm font-medium">
                Explore {c.count} pieces <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function StorySection({ section }: { section: Of<"story"> }) {
  return (
    <section className="container-page grid items-center gap-10 py-24 lg:grid-cols-2 lg:gap-20">
      {section.imageUrl && (
        <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-muted lg:aspect-[5/6]">
          <SmartImage src={section.imageUrl} alt="" fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
        </div>
      )}
      <div className="max-w-lg">
        {section.eyebrow && <p className="eyebrow">{section.eyebrow}</p>}
        <h2 className="mt-4 font-heading text-4xl leading-tight sm:text-5xl">{section.title}</h2>
        {section.body && <p className="mt-6 text-[1.02rem] leading-8 text-foreground/75">{section.body}</p>}
        {section.ctaLabel && section.ctaHref && (
          <Button asChild variant="outline" size="lg" className="mt-8">
            <Link href={section.ctaHref}>{section.ctaLabel}</Link>
          </Button>
        )}
      </div>
    </section>
  );
}

export function TestimonialsSection({ section }: { section: Of<"testimonials"> }) {
  return (
    <section className="container-page py-20">
      <div className="text-center">
        <h2 className="font-heading text-3xl sm:text-[2.4rem]">{section.title}</h2>
        {section.subtitle && <p className="mt-2 text-muted-foreground">{section.subtitle}</p>}
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {section.items.map((t) => (
          <figure key={t.id} className="flex flex-col rounded-xl border bg-card p-8 shadow-[var(--shadow-soft)]">
            <Quote className="size-6 text-clay" aria-hidden />
            <RatingStars rating={t.rating} className="mt-4" />
            <blockquote className="mt-4 flex-1 font-heading text-lg leading-relaxed">“{t.quote}”</blockquote>
            <figcaption className="mt-6 text-sm">
              <span className="font-medium">{t.name}</span>
              {t.location && <span className="text-muted-foreground"> · {t.location}</span>}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export function NewsletterSection({ heading, subheading }: { heading: string; subheading: string }) {
  return (
    <section className="container-page py-12">
      <div className="rounded-2xl bg-sand/60 px-6 py-16 text-center sm:px-12">
        <p className="eyebrow">Newsletter</p>
        <h2 className="mt-3 font-heading text-3xl sm:text-4xl">{heading}</h2>
        <p className="mx-auto mt-3 max-w-lg text-foreground/70">{subheading}</p>
        <div className="mx-auto mt-8 max-w-md">
          <NewsletterForm source="homepage" />
        </div>
      </div>
    </section>
  );
}

export function InstagramSection({ section }: { section: Of<"instagram"> }) {
  return (
    <section className="py-20">
      <div className="container-page mb-8 flex flex-col items-center text-center">
        <Camera className="size-5 text-clay" aria-hidden />
        <h2 className="mt-3 font-heading text-3xl">{section.title}</h2>
        {section.subtitle && <p className="mt-2 text-muted-foreground">{section.subtitle}</p>}
      </div>
      <div className="grid grid-cols-3 gap-1 sm:grid-cols-6">
        {section.images.map((src, i) => {
          const tile = (
            <div className="group relative aspect-square overflow-hidden bg-muted">
              <SmartImage src={src} alt="" fill sizes="(max-width:640px) 33vw, 17vw" className="object-cover transition duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/25">
                <Camera className="size-5 text-white opacity-0 transition group-hover:opacity-100" />
              </div>
            </div>
          );
          return section.url ? (
            <a key={i} href={section.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${section.handle ?? "Instagram"} on Instagram`}>
              {tile}
            </a>
          ) : (
            <div key={i}>{tile}</div>
          );
        })}
      </div>
    </section>
  );
}
