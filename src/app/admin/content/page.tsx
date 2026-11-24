import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { requireStaff } from "@/lib/auth/guards";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { BannersManager } from "@/components/admin/content/banners-manager";
import { SectionsManager } from "@/components/admin/content/sections-manager";
import { CollectionsManager } from "@/components/admin/content/collections-manager";
import { listBanners, listCollections, listSections } from "@/services/admin/content";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Homepage & banners" };

const TABS = [
  { key: "banners", label: "Banners" },
  { key: "sections", label: "Homepage sections" },
  { key: "collections", label: "Featured collections" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default async function ContentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff("content.manage", "/admin/content");
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "banners";

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Homepage & banners"
        description="Control what customers see first: hero banners, homepage layout and curated collections."
        actions={
          <Button variant="outline" asChild>
            <Link href="/" target="_blank">
              <ExternalLink /> Preview homepage
            </Link>
          </Button>
        }
      />
      <nav className="mb-5 flex gap-1 overflow-x-auto border-b" aria-label="Content sections">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "banners" ? "/admin/content" : `/admin/content?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-sm whitespace-nowrap transition",
              tab === t.key ? "border-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <Panel>
        {tab === "banners" && <BannersManager banners={await listBanners()} />}
        {tab === "sections" && <SectionsManager sections={await listSections()} />}
        {tab === "collections" && <CollectionsManager collections={await listCollections()} />}
      </Panel>
    </div>
  );
}
