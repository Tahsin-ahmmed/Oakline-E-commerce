import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { Settings } from "@/lib/validations/settings";
import type { CategoryNode } from "@/services/catalog";
import { Logo } from "@/components/layout/logo";
import { SearchBox } from "@/components/layout/search-box";
import { HeaderActions } from "@/components/layout/header-actions";
import { MobileNav } from "@/components/layout/mobile-nav";

export function SiteHeader({
  settings,
  categories,
  cartCount,
}: {
  settings: Settings;
  categories: CategoryNode[];
  cartCount: number;
}) {
  const primary = categories.slice(0, 7);
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="container-page flex h-16 items-center gap-4 lg:h-[4.5rem]">
        <MobileNav categories={categories} siteName={settings.general.siteName} />
        <Logo siteName={settings.general.siteName} logoUrl={settings.general.logoUrl || undefined} className="shrink-0" />
        <div className="mx-auto hidden w-full max-w-md md:block">
          <SearchBox />
        </div>
        <HeaderActions cartCount={cartCount} />
      </div>

      <nav aria-label="Categories" className="hidden border-t lg:block">
        <ul className="container-page flex h-11 items-center gap-7 text-[0.82rem]">
          <li>
            <Link href="/products?sort=newest" className="font-medium text-foreground/80 transition hover:text-foreground">
              New In
            </Link>
          </li>
          {primary.map((cat) => (
            <li key={cat.id} className="group relative">
              <Link
                href={`/categories/${cat.slug}`}
                className="flex items-center gap-1 py-3 text-foreground/80 transition hover:text-foreground"
              >
                {cat.name}
                {cat.children.length > 0 && <ChevronDown className="size-3 opacity-60 transition group-hover:rotate-180" />}
              </Link>
              {cat.children.length > 0 && (
                <div className="invisible absolute top-full left-1/2 z-50 w-64 -translate-x-1/2 translate-y-1 rounded-lg border bg-popover p-2 opacity-0 shadow-[var(--shadow-lift)] transition-all group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                  <Link href={`/categories/${cat.slug}`} className="block rounded-md px-3 py-2 font-medium hover:bg-secondary">
                    All {cat.name}
                  </Link>
                  {cat.children.map((child) => (
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
          <li className="ml-auto">
            <Link href="/products?onSale=1" className="font-medium text-clay transition hover:opacity-80">
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
