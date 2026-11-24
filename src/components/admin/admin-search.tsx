"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Package, Search, ShoppingCart, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { api } from "@/lib/api-client";

interface Results {
  orders: { id: string; orderNumber: string; customerName: string }[];
  products: { id: string; name: string; sku: string }[];
  customers: { id: string; name: string; email: string }[];
}

export function AdminSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const { data } = useQuery({
    queryKey: ["admin-search", debounced],
    queryFn: () => api<Results>(`/api/admin/search?q=${encodeURIComponent(debounced)}`),
    enabled: open && debounced.length >= 2,
  });
  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };
  return (
    <>
      <Button variant="outline" className="hidden h-9 w-56 justify-start gap-2 text-muted-foreground md:flex" onClick={() => setOpen(true)}>
        <Search className="size-4" /> Search…
        <kbd className="ml-auto rounded border bg-muted px-1.5 text-[0.65rem]">Ctrl K</kbd>
      </Button>
      <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label="Search">
        <Search className="size-5" />
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search admin">
        <Command shouldFilter={false}>
        <CommandInput placeholder="Search orders, products, customers…" value={q} onValueChange={setQ} />
        <CommandList>
          {debounced.length >= 2 && <CommandEmpty>No results.</CommandEmpty>}
          {!!data?.orders.length && (
            <CommandGroup heading="Orders">
              {data.orders.map((o) => (
                <CommandItem key={o.id} value={`o-${o.id}`} onSelect={() => go(`/admin/orders/${o.id}`)}>
                  <ShoppingCart /> {o.orderNumber} <span className="text-muted-foreground">· {o.customerName}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {!!data?.products.length && (
            <CommandGroup heading="Products">
              {data.products.map((p) => (
                <CommandItem key={p.id} value={`p-${p.id}`} onSelect={() => go(`/admin/products/${p.id}`)}>
                  <Package /> {p.name} <span className="text-muted-foreground">· {p.sku}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {!!data?.customers.length && (
            <CommandGroup heading="Customers">
              {data.customers.map((c) => (
                <CommandItem key={c.id} value={`c-${c.id}`} onSelect={() => go(`/admin/customers/${c.id}`)}>
                  <User /> {c.name} <span className="text-muted-foreground">· {c.email}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
