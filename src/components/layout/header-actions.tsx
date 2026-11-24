"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, LayoutDashboard, LogOut, Package, ShoppingBag, User, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStore } from "@/components/shared/store-context";
import { useCartUI } from "@/components/cart/cart-ui-context";
import { useCartCount } from "@/hooks/use-cart";
import { useWishlistIds } from "@/hooks/use-wishlist";
import { api } from "@/lib/api-client";

export function useSignOut() {
  const router = useRouter();
  const qc = useQueryClient();
  return async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      qc.clear();
      toast.success("You've been signed out.");
      router.push("/");
      router.refresh();
    }
  };
}

export function HeaderActions({ cartCount }: { cartCount: number }) {
  const { user } = useStore();
  const cartUI = useCartUI();
  const { data: count = cartCount } = useCartCount(cartCount);
  const { data: wishlist = [] } = useWishlistIds();
  const signOut = useSignOut();

  return (
    <div className="ml-auto flex items-center gap-0.5 md:ml-0">
      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Account menu">
              <UserRound className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {user.isStaff && (
              <DropdownMenuItem asChild>
                <Link href="/admin">
                  <LayoutDashboard /> Admin dashboard
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href="/account">
                <User /> My account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/account/orders">
                <Package /> Orders
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/wishlist">
                <Heart /> Wishlist
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOut}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button variant="ghost" size="icon" asChild aria-label="Sign in">
          <Link href="/login">
            <UserRound className="size-5" />
          </Link>
        </Button>
      )}
      <Button variant="ghost" size="icon" asChild aria-label={`Wishlist (${wishlist.length} items)`} className="relative">
        <Link href="/wishlist">
          <Heart className="size-5" />
          {wishlist.length > 0 && (
            <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-clay text-[0.6rem] font-semibold text-clay-foreground">
              {wishlist.length > 9 ? "9+" : wishlist.length}
            </span>
          )}
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={cartUI.open}
        aria-label={`Shopping bag (${count} items)`}
        data-testid="cart-button"
      >
        <ShoppingBag className="size-5" />
        {count > 0 && (
          <span
            data-testid="cart-count"
            className="absolute top-1 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.6rem] font-semibold text-primary-foreground"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Button>
    </div>
  );
}
