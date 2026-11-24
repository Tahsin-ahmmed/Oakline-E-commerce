import type { Metadata } from "next";
import Link from "next/link";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { getWishlistProducts } from "@/services/wishlist";
import { EmptyState } from "@/components/shared/empty-state";
import { WishlistGrid } from "@/components/account/wishlist-grid";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false } };

export default async function WishlistPage() {
  const user = await getCurrentUser();
  return (
    <div className="container-page py-10 lg:py-14">
      <p className="eyebrow">Saved for later</p>
      <h1 className="mt-2 mb-8 font-heading text-4xl">Wishlist</h1>
      {user ? (
        <WishlistGrid initial={await getWishlistProducts(user.id)} />
      ) : (
        <EmptyState
          icon={Heart}
          title="Sign in to see your wishlist"
          description="Save favourites to your account and find them on any device."
          action={
            <div className="flex gap-3">
              <Button asChild>
                <Link href="/login?next=/wishlist">Sign in</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/register?next=/wishlist">Create account</Link>
              </Button>
            </div>
          }
        />
      )}
    </div>
  );
}
