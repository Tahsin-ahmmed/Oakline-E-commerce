"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { CategoryNode } from "@/services/catalog";
import { useStore } from "@/components/shared/store-context";

export function MobileNav({ categories, siteName }: { categories: CategoryNode[]; siteName: string }) {
  const [open, setOpen] = useState(false);
  const { user } = useStore();
  const close = () => setOpen(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="-ml-2 lg:hidden" aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[86vw] max-w-sm overflow-y-auto p-0">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="font-heading text-2xl font-normal">{siteName}</SheetTitle>
        </SheetHeader>
        <nav className="px-5 py-3" aria-label="Mobile">
          <Link href="/products?sort=newest" onClick={close} className="flex items-center justify-between border-b py-3.5 text-[0.95rem]">
            New In <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
          <Accordion type="single" collapsible>
            {categories.map((c) => (
              <AccordionItem key={c.id} value={c.id}>
                <AccordionTrigger className="py-3.5 text-[0.95rem] font-normal hover:no-underline">{c.name}</AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-1 pb-2 pl-2">
                    <Link href={`/categories/${c.slug}`} onClick={close} className="py-1.5 text-sm font-medium">
                      Shop all {c.name}
                    </Link>
                    {c.children.map((s) => (
                      <Link key={s.id} href={`/categories/${s.slug}`} onClick={close} className="py-1.5 text-sm text-muted-foreground">
                        {s.name}
                      </Link>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <Link href="/products?onSale=1" onClick={close} className="flex items-center justify-between border-b py-3.5 text-[0.95rem] text-clay">
            Sale <ChevronRight className="size-4" />
          </Link>
          <div className="grid gap-1 py-5 text-sm text-muted-foreground">
            <Link href={user ? "/account" : "/login"} onClick={close} className="py-1.5">
              {user ? "My account" : "Sign in / Register"}
            </Link>
            <Link href="/track-order" onClick={close} className="py-1.5">
              Track an order
            </Link>
            <Link href="/blog" onClick={close} className="py-1.5">
              Journal
            </Link>
            <Link href="/contact" onClick={close} className="py-1.5">
              Contact us
            </Link>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
