import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Brand wordmark. Uses the uploaded logo from Settings when present, otherwise the bundled Ezyza
 * wordmark — charcoal for light backgrounds ("dark"), champagne gold for dark backgrounds ("gold").
 */
export function Logo({
  siteName,
  logoUrl,
  className,
  href = "/",
  tone = "dark",
  size = "md",
}: {
  siteName: string;
  logoUrl?: string;
  className?: string;
  href?: string;
  tone?: "dark" | "gold";
  size?: "sm" | "md" | "lg";
}) {
  const height = { sm: "h-5", md: "h-6 sm:h-7", lg: "h-9" }[size];
  const src = logoUrl || (tone === "gold" ? "/brand/ezyza-logo-gold.png" : "/brand/ezyza-logo-dark.png");
  return (
    <Link href={href} className={cn("flex items-center", className)} aria-label={`${siteName} home`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={siteName} className={cn("w-auto", height)} />
    </Link>
  );
}
