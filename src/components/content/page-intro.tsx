import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <li>
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
        </li>
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-1.5">
            <ChevronRight className="size-3" />
            {item.href ? (
              <Link href={item.href} className="hover:text-foreground">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-foreground">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
  crumbs,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  crumbs?: { label: string; href?: string }[];
  className?: string;
}) {
  return (
    <header className={cn("container-page pt-10 pb-10 sm:pt-14", className)}>
      {crumbs && <Crumbs items={crumbs} />}
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1 className="mt-3 max-w-3xl text-4xl leading-[1.1] sm:text-5xl">{title}</h1>
      {description && <p className="mt-4 max-w-2xl text-[1.02rem] leading-7 text-muted-foreground">{description}</p>}
    </header>
  );
}

/** Safe JSON-LD script (escapes "<" to prevent breaking out of the script tag). */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
