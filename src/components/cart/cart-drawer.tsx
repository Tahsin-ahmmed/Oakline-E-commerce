"use client";

import Link from "next/link";
import { AlertTriangle, Loader2, ShoppingBag, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Money, Price } from "@/components/shared/price";
import { SmartImage } from "@/components/shared/smart-image";
import { EmptyState } from "@/components/shared/empty-state";
import { useCartUI } from "@/components/cart/cart-ui-context";
import { QuantityInput } from "@/components/cart/quantity-input";
import { useCart, useRemoveCartItem, useUpdateCartItem } from "@/hooks/use-cart";

export function FreeShippingMeter({ subtotal, threshold }: { subtotal: string; threshold: string | null }) {
  if (!threshold) return null;
  const sub = Number(subtotal);
  const target = Number(threshold);
  const remaining = Math.max(0, target - sub);
  return (
    <div className="rounded-lg bg-secondary/70 px-4 py-3">
      <p className="flex items-center gap-2 text-xs">
        <Truck className="size-3.5" />
        {remaining > 0 ? (
          <span>
            You&apos;re <Money value={remaining} className="font-semibold" /> away from free delivery
          </span>
        ) : (
          <span className="font-medium">You&apos;ve unlocked free delivery</span>
        )}
      </p>
      <Progress value={Math.min(100, (sub / target) * 100)} className="mt-2 h-1.5" />
    </div>
  );
}

export function CartDrawer() {
  const { isOpen, setOpen, close } = useCartUI();
  const { data: cart, isLoading } = useCart(isOpen);
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle className="font-heading text-xl font-normal">
            Your bag {cart && cart.itemCount > 0 && <span className="text-muted-foreground">({cart.itemCount})</span>}
          </SheetTitle>
        </SheetHeader>

        {isLoading || !cart ? (
          <div className="space-y-4 p-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="size-20 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : cart.items.length === 0 ? (
          <div className="flex flex-1 items-center p-6">
            <EmptyState
              icon={ShoppingBag}
              title="Your bag is empty"
              description="Discover pieces made to last — they'll wait for you here."
              className="w-full border-none bg-transparent"
              action={
                <Button asChild onClick={close}>
                  <Link href="/products">Start shopping</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <div className="px-6 pt-4">
              <FreeShippingMeter subtotal={cart.subtotal} threshold={cart.freeShippingThreshold} />
            </div>
            <ul className="flex-1 divide-y overflow-y-auto px-6">
              {cart.items.map((item) => (
                <li key={item.id} className="flex gap-4 py-5">
                  <Link href={`/products/${item.slug}`} onClick={close} className="relative size-20 shrink-0 overflow-hidden rounded-md bg-muted">
                    {item.image && <SmartImage src={item.image} alt={item.name} fill sizes="80px" className="object-cover" />}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/products/${item.slug}`} onClick={close} className="line-clamp-2 text-sm font-medium hover:underline">
                          {item.name}
                        </Link>
                        {item.variantName && <p className="mt-0.5 text-xs text-muted-foreground">{item.variantName}</p>}
                      </div>
                      <Price price={item.regularPrice} salePrice={item.unitPrice !== item.regularPrice ? item.unitPrice : null} size="sm" className="shrink-0 flex-col items-end gap-0" />
                    </div>
                    {item.warning && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-destructive">
                        <AlertTriangle className="size-3" /> {item.warning}
                      </p>
                    )}
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <QuantityInput
                        size="sm"
                        value={item.quantity}
                        max={Math.max(1, Math.min(99, item.available))}
                        disabled={update.isPending}
                        onChange={(q) => update.mutate({ itemId: item.id, quantity: q })}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => remove.mutate(item.id)}
                        disabled={remove.isPending}
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 className="size-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <SheetFooter className="gap-3 border-t bg-card px-6 py-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="flex items-center gap-2 font-medium">
                  {(update.isPending || remove.isPending) && <Loader2 className="size-3.5 animate-spin" />}
                  <Money value={cart.subtotal} />
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Shipping and discounts are calculated at checkout.</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" asChild onClick={close}>
                  <Link href="/cart">View bag</Link>
                </Button>
                <Button asChild onClick={close} disabled={cart.hasIssues}>
                  <Link href="/checkout" aria-disabled={cart.hasIssues}>
                    Checkout
                  </Link>
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
