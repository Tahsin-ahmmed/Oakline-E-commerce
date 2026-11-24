import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import type { Settings } from "@/lib/validations/settings";
import type { CategoryNode } from "@/services/catalog";
import { productTypesFromTree } from "@/lib/product-types";
import { Logo } from "@/components/layout/logo";
import { NewsletterForm } from "@/components/layout/newsletter-form";

const SOCIAL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  pinterest: "Pinterest",
  youtube: "YouTube",
  tiktok: "TikTok",
};

export function SiteFooter({ settings, categories }: { settings: Settings; categories: CategoryNode[] }) {
  const { general, social, newsletter } = settings;
  const socials = Object.entries(social).filter(([, url]) => url);
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 bg-primary text-primary-foreground">
      <div className="container-page grid gap-12 py-16 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Logo siteName={general.siteName} tone="gold" size="lg" />
          <p className="mt-4 max-w-xs text-sm leading-6 text-primary-foreground/70">{general.tagline}</p>
          {newsletter.enabled && (
            <div className="mt-8 max-w-sm">
              <p className="mb-3 text-sm font-medium">{newsletter.heading}</p>
              <NewsletterForm tone="dark" />
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-8">
          <div>
            <h2 className="eyebrow !text-primary-foreground/60">Shop</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {categories.slice(0, 4).map((c) => (
                <li key={c.id}>
                  <Link href={`/categories/${c.slug}`} className="font-medium text-primary-foreground hover:text-sand">
                    {c.name}
                  </Link>
                </li>
              ))}
              {productTypesFromTree(categories).slice(0, 8).map((t) => (
                <li key={t.slug}>
                  <Link href={`/products?type=${t.slug}`} className="text-primary-foreground/80 hover:text-primary-foreground">
                    {t.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/products?onSale=1" className="text-primary-foreground/80 hover:text-primary-foreground">
                  Sale
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="eyebrow !text-primary-foreground/60">Help</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {[
                ["Track your order", "/track-order"],
                ["Shipping policy", "/shipping-policy"],
                ["Returns & refunds", "/returns-policy"],
                ["FAQ", "/faq"],
                ["Contact us", "/contact"],
              ].map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="text-primary-foreground/80 hover:text-primary-foreground">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <h2 className="eyebrow !text-primary-foreground/60">Company</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {[
                ["About us", "/about"],
                ["Journal", "/blog"],
                ["Privacy policy", "/privacy-policy"],
                ["Terms & conditions", "/terms"],
              ].map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="text-primary-foreground/80 hover:text-primary-foreground">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="mt-6 space-y-2 text-sm text-primary-foreground/70">
              {general.address && (
                <li className="flex gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0" /> {general.address}
                </li>
              )}
              {general.phone && (
                <li className="flex gap-2">
                  <Phone className="mt-0.5 size-4 shrink-0" />
                  <a href={`tel:${general.phone.replace(/\s/g, "")}`}>{general.phone}</a>
                </li>
              )}
              {general.contactEmail && (
                <li className="flex gap-2">
                  <Mail className="mt-0.5 size-4 shrink-0" />
                  <a href={`mailto:${general.contactEmail}`}>{general.contactEmail}</a>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-4 py-6 text-xs text-primary-foreground/60 sm:flex-row">
          <p className="text-center sm:text-left">
            © {year} {general.siteName}. All rights reserved.
            <span className="mx-2 hidden sm:inline" aria-hidden>
              ·
            </span>
            <span className="block sm:inline">
              Developed by <span className="font-medium text-sand">Tahsin Ahmmed</span>
            </span>
          </p>
          {socials.length > 0 && (
            <ul className="flex gap-5">
              {socials.map(([key, url]) => (
                <li key={key}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-primary-foreground">
                    {SOCIAL_LABELS[key] ?? key}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p>Cash on Delivery · Visa · Mastercard</p>
        </div>
      </div>
    </footer>
  );
}
