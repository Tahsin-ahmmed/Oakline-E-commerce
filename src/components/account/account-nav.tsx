"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, LayoutGrid, LogOut, MapPin, Package, Shield, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSignOut } from "@/components/layout/header-actions";

const ITEMS = [
  { href: "/account", label: "Overview", icon: LayoutGrid },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/profile", label: "Profile", icon: User },
  { href: "/account/security", label: "Security", icon: Shield },
];

export function AccountNav() {
  const pathname = usePathname();
  const signOut = useSignOut();
  return (
    <nav aria-label="Account" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
      <ul className="flex gap-1 lg:flex-col">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/account" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm whitespace-nowrap transition",
                  active ? "bg-secondary font-medium" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4" /> {label}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm whitespace-nowrap text-muted-foreground transition hover:bg-secondary/60 hover:text-foreground"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </li>
      </ul>
    </nav>
  );
}
