"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useState } from "react";
import { ExternalLink, LogOut, Menu, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAdmin } from "@/components/admin/admin-context";
import { ADMIN_NAV, SEGMENT_LABELS } from "@/components/admin/nav-config";
import { AdminSearch } from "@/components/admin/admin-search";
import { NotificationBell } from "@/components/admin/notification-bell";
import { useSignOut } from "@/components/layout/header-actions";

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can } = useAdmin();
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Admin">
      {ADMIN_NAV.map((group) => {
        const items = group.items.filter((i) => !i.permission || can(i.permission));
        if (!items.length) return null;
        return (
          <div key={group.label}>
            <p className="px-3 pb-2 text-[0.65rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">{group.label}</p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname === item.href ||
                      (pathname.startsWith(item.href + "/") &&
                        !ADMIN_NAV.some((g) => g.items.some((o) => o.href !== item.href && o.href.startsWith(item.href + "/") && pathname.startsWith(o.href))));
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                        active ? "bg-sidebar-accent font-medium text-foreground" : "text-foreground/70 hover:bg-sidebar-accent/60 hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function Crumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  return (
    <Breadcrumb className="hidden md:block">
      <BreadcrumbList>
        {segments.map((seg, i) => {
          const href = "/" + segments.slice(0, i + 1).join("/");
          const label = SEGMENT_LABELS[seg] ?? (seg.length > 16 ? "Details" : decodeURIComponent(seg));
          const last = i === segments.length - 1;
          return (
            <Fragment key={href}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {last ? <BreadcrumbPage>{label}</BreadcrumbPage> : <BreadcrumbLink asChild><Link href={href}>{label}</Link></BreadcrumbLink>}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, siteName } = useAdmin();
  const [mobileOpen, setMobileOpen] = useState(false);
  const signOut = useSignOut();
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const brand = (
    <Link href="/admin" className="flex items-center gap-2 px-6 py-5">
      <span className="font-heading text-xl">{siteName}</span>
      <span className="rounded bg-secondary px-1.5 py-0.5 text-[0.6rem] font-semibold tracking-wider uppercase">Admin</span>
    </Link>
  );

  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-sidebar lg:flex">
        {brand}
        <SidebarNav />
        <div className="border-t p-3">
          <Link href="/" target="_blank" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent">
            <ExternalLink className="size-4" /> View storefront
          </Link>
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="flex w-72 flex-col p-0">
          <SheetTitle className="sr-only">Admin navigation</SheetTitle>
          {brand}
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu className="size-5" />
          </Button>
          <Crumbs />
          <div className="ml-auto flex items-center gap-2">
            <AdminSearch />
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 gap-2 px-2" aria-label="Profile menu">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-sand text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm sm:inline">{user.name.split(" ")[0]}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  <p className="mt-1 text-[0.7rem] text-muted-foreground">{user.roles.map((r) => r.replace(/_/g, " ").toLowerCase()).join(", ")}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/account">
                    <User /> My account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/" target="_blank">
                    <ExternalLink /> View storefront
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={signOut}>
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
