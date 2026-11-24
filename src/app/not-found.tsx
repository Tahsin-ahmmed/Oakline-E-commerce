import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-20 text-center">
      <Link href="/" aria-label="Ezyza home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/ezyza-logo-dark.png" alt="Ezyza" className="h-8 w-auto" />
      </Link>
      <p className="mt-16 font-heading text-[6rem] leading-none text-clay/80 sm:text-[9rem]">404</p>
      <h1 className="mt-4 font-heading text-3xl sm:text-4xl">We couldn&apos;t find that page</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        The page may have moved, or the link might be out of date. Let&apos;s get you back to the shop.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Button asChild size="lg">
          <Link href="/">Back to home</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/products">Shop all products</Link>
        </Button>
      </div>
      <nav aria-label="Helpful links" className="mt-12 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
        <Link href="/search" className="hover:text-foreground">
          Search
        </Link>
        <Link href="/track-order" className="hover:text-foreground">
          Track an order
        </Link>
        <Link href="/contact" className="hover:text-foreground">
          Contact us
        </Link>
      </nav>
    </main>
  );
}
