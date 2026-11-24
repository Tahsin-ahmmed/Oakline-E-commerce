import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { Settings } from "@/lib/validations/settings";
import type { CategoryNode } from "@/services/catalog";
import { productTypesFromTree } from "@/lib/product-types";
import { Logo } from "@/components/layout/logo";
import { SearchBox } from "@/components/layout/search-box";
import { HeaderActions } from "@/components/layout/header-actions";
import { MobileNav } from "@/components/layout/mobile-nav";

const dropdown =
  "invisible absolute top-full left-1/2 z-50 w-60 -translate-x-1/2 translate-y-1 rounded-lg border bg-popover p-2 opacity-0 shadow-[var(--shadow-lift)] transition-all group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100";
const navLink = "flex items-center gap-1 py-3 text-foreground/80 transition hover:text-foreground";

export function SiteHeader({
  settings,
  categories,
  cartCount,
}: {
  settings: Settings;
  categories: CategoryNode[];
  cartCount: number;
}) {
  const departments = categories.slice(0, 4);
  const types = productTypesFromTree(categories);
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container-page flex h-16 items-center gap-4 lg:h-[4.5rem]">
        <MobileNav categories={categories} siteName={settings.general.siteName} />
        <Logo siteName={settings.general.siteName} logoUrl={settings.general.logoUrl || undefined} className="shrink-0" />
        <div className="mx-auto hidden w-full max-w-md md:block">
          <SearchBox />
        </div>
        <HeaderActions cartCount={cartCount} />
      </div>

      <nav aria-label="Main" className="hidden border-t lg:block">
        <ul className="container-page flex h-11 items-center gap-6 text-[0.8rem] tracking-wide uppercase">
          <li>
            <Link href="/products?sort=newest" className="font-medium text-foreground/80 transition hover:text-foreground">
              New In
            </Link>
          </li>
          {departments.map((dept) => (
            <li key={dept.id} className="group relative">
              <Link href={`/categories/${dept.slug}`} className={`${navLink} font-semibold text-foreground`}>
                {dept.name}
                {dept.children.length > 0 && <ChevronDown className="size-3 opacity-60 transition group-hover:rotate-180" />}
              </Link>
              {dept.children.length > 0 && (
                <div className={`${dropdown} normal-case tracking-normal`}>
                  <Link href={`/categories/${dept.slug}`} className="block rounded-md px-3 py-2 font-medium hover:bg-secondary">
                    Shop all {dept.name}
                  </Link>
                  {dept.children.map((child) => (
                    <Link
                      key={child.id}
                      href={`/categories/${child.slug}`}
                      className="block rounded-md px-3 py-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      {child.name}
                    </Link>
                  ))}
                </div>
              )}
            </li>
          ))}

          {types.length > 0 && (
            <>
              <li aria-hidden className="h-4 w-px bg-border" />
              {/* Medium desktops: one dropdown. Wide screens: inline links. */}
              <li className="group relative xl:hidden">
                <button type="button" className={`${navLink} uppercase`}>
                  Shop by product <ChevronDown className="size-3 opacity-60 transition group-hover:rotate-180" />
                </button>
                <div className={`${dropdown} normal-case tracking-normal`}>
                  {types.map((t) => (
                    <Link key={t.slug} href={`/products?type=${t.slug}`} className="block rounded-md px-3 py-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
                      {t.name}
                    </Link>
                  ))}
                </div>
              </li>
              {types.map((t) => (
                <li key={t.slug} className="hidden xl:block">
                  <Link href={`/products?type=${t.slug}`} className="text-foreground/70 transition hover:text-foreground">
                    {t.name}
                  </Link>
                </li>
              ))}
            </>
          )}

          <li className="ml-auto">
            <Link href="/products?onSale=1" className="font-semibold text-clay transition hover:opacity-80">
              Sale
            </Link>
          </li>
        </ul>
      </nav>
      <div className="container-page pb-3 md:hidden">
        <SearchBox />
      </div>
    </header>
  );
}
