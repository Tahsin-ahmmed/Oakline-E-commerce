"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, Lock, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/shared/empty-state";
import { Money, Price } from "@/components/shared/price";
import { SmartImage } from "@/components/shared/smart-image";
import { FreeShippingMeter } from "@/components/cart/cart-drawer";
import { QuantityInput } from "@/components/cart/quantity-input";
import { CouponForm } from "@/components/cart/coupon-form";
import { useApplyCoupon, useCart, useRemoveCartItem, useRemoveCoupon, useUpdateCartItem } from "@/hooks/use-cart";

function CartSkeleton() {
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-5">
            <Skeleton className="size-28 rounded-lg" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-9 w-32" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

export function CartPage() {
  const { data: cart, isLoading, isError, refetch } = useCart();
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();
  const applyCoupon = useApplyCoupon();
  const removeCoupon = useRemoveCoupon();

  if (isLoading) return <CartSkeleton />;
  if (isError || !cart) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="We couldn't load your bag"
        description="Please check your connection and try again."
        action={<Button onClick={() => refetch()}>Try again</Button>}
      />
    );
  }
  if (cart.items.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Your bag is empty"
        description="Looks like you haven't added anything yet. Explore our latest pieces."
        action={
          <Button asChild size="lg">
            <Link href="/products">Start shopping</Link>
          </Button>
        }
      />
    );
  }

  const busy = update.isPending || remove.isPending;
  const discount = Number(cart.discount);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-14">
      <section aria-labelledby="bag-items">
        <h2 id="bag-items" className="sr-only">
          Items in your bag
        </h2>
        {cart.hasIssues && (
          <div role="alert" className="mb-6 flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            Some items need your attention before you can check out. Adjust the quantity or remove unavailable items.
          </div>
        )}
        <div className="hidden grid-cols-[1fr_140px_120px] border-b pb-3 text-xs tracking-wider text-muted-foreground uppercase md:grid">
          <span>Product</span>
          <span className="text-center">Quantity</span>
          <span className="text-right">Total</span>
        </div>
        <ul className="divide-y">
          {cart.items.map((item) => (
            <li key={item.id} className="grid grid-cols-[96px_1fr] gap-4 py-6 md:grid-cols-[112px_1fr_140px_120px] md:items-center md:gap-6">
              <Link href={`/products/${item.slug}`} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                {item.image && <SmartImage src={item.image} alt={item.name} fill sizes="112px" className="object-cover" />}
              </Link>
              <div className="min-w-0">
                <Link href={`/products/${item.slug}`} className="font-medium hover:underline">
                  {item.name}
                </Link>
                {item.variantName && <p className="mt-0.5 text-sm text-muted-foreground">{item.variantName}</p>}
                <p className="mt-0.5 text-xs text-muted-foreground">SKU {item.sku}</p>
                <Price
                  price={item.regularPrice}
                  salePrice={item.unitPrice !== item.regularPrice ? item.unitPrice : null}
                  size="sm"
                  className="mt-2"
                />
                {item.warning && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive">
                    <AlertTriangle className="size-3.5" /> {item.warning}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-3 md:hidden">
                  <QuantityInput
                    size="sm"
                    value={item.quantity}
                    max={Math.max(1, Math.min(99, item.available))}
                    disabled={busy || item.available <= 0}
                    onChange={(q) => update.mutate({ itemId: item.id, quantity: q })}
                  />
                  <Money value={item.lineTotal} className="ml-auto font-medium" />
                </div>
                <button
                  type="button"
                  onClick={() => remove.mutate(item.id)}
                  disabled={busy}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" /> Remove
                </button>
              </div>
              <div className="hidden justify-center md:flex">
                <QuantityInput
                  value={item.quantity}
                  max={Math.max(1, Math.min(99, item.available))}
                  disabled={busy || item.available <= 0}
                  onChange={(q) => update.mutate({ itemId: item.id, quantity: q })}
                />
              </div>
              <Money value={item.lineTotal} className="hidden text-right font-medium md:block" />
            </li>
          ))}
        </ul>
        <Button variant="link" asChild className="mt-4 px-0">
          <Link href="/products">
            <ArrowLeft /> Continue shopping
          </Link>
        </Button>
      </section>

      <aside className="h-fit space-y-5 rounded-xl border bg-card p-6 shadow-[var(--shadow-soft)] lg:sticky lg:top-32">
        <h2 className="font-heading text-xl">Order summary</h2>
        <FreeShippingMeter subtotal={cart.subtotal} threshold={cart.freeShippingThreshold} />
        <CouponForm
          appliedCode={cart.couponCode}
          message={cart.couponMessage}
          pending={applyCoupon.isPending || removeCoupon.isPending}
          onApply={(code) => applyCoupon.mutateAsync(code)}
          onRemove={() => removeCoupon.mutateAsync()}
        />
        <dl className="space-y-2.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal ({cart.itemCount} items)</dt>
            <dd>
              <Money value={cart.subtotal} />
            </dd>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-success">
              <dt>Discount {cart.couponCode && `(${cart.couponCode})`}</dt>
              <dd>
                -<Money value={cart.discount} />
              </dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">
              Shipping
              {cart.shippingEstimate && <span className="block text-xs">{cart.shippingEstimate.label}</span>}
            </dt>
            <dd>
              {cart.freeShippingCoupon || cart.shippingEstimate?.isFree ? (
                "Free"
              ) : cart.shippingEstimate ? (
                <Money value={cart.shippingEstimate.fee} />
              ) : (
                "At checkout"
              )}
            </dd>
          </div>
        </dl>
        <Separator />
        <div className="flex items-baseline justify-between">
          <span className="font-medium">Estimated total</span>
          <Money value={cart.estimatedTotal} className="text-xl font-semibold" />
        </div>
        <p className="text-xs text-muted-foreground">Final shipping is calculated from your delivery address at checkout.</p>
        {cart.hasIssues ? (
          <Button size="lg" className="w-full" disabled>
            Resolve issues to check out
          </Button>
        ) : (
          <Button size="lg" className="w-full" asChild>
            <Link href="/checkout" data-testid="checkout-link">
              <Lock /> Proceed to checkout
            </Link>
          </Button>
        )}
        <p className="text-center text-xs text-muted-foreground">Cash on Delivery available across Bangladesh</p>
      </aside>
    </div>
  );
}
