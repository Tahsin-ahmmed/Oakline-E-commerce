import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ siteName, logoUrl, className, href = "/" }: { siteName: string; logoUrl?: string; className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2", className)} aria-label={`${siteName} home`}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={siteName} className="h-8 w-auto" />
      ) : (
        <>
          <svg viewBox="0 0 32 32" className="size-7 text-clay" aria-hidden>
            <circle cx="16" cy="16" r="14.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M16 6c5 4 6.5 9 0 20C9.5 15 11 10 16 6Z" fill="currentColor" opacity=".9" />
            <path d="M16 9v17" stroke="var(--background)" strokeWidth="1" />
          </svg>
          <span className="font-heading text-[1.6rem] leading-none tracking-tight">{siteName}</span>
        </>
      )}
    </Link>
  );
}
