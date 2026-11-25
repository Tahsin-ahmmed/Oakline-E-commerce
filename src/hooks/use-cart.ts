"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import { useCartUI } from "@/components/cart/cart-ui-context";
import { pixelTrack } from "@/components/analytics/tracker";
import { useStore } from "@/components/shared/store-context";
import type { CartView } from "@/services/cart";

export type { CartView, CartLine } from "@/services/cart";

export const CART_KEY = ["cart"] as const;
export const CART_COUNT_KEY = ["cart-count"] as const;

export function useCart(enabled = true) {
  return useQuery({ queryKey: CART_KEY, queryFn: () => api<CartView>("/api/cart"), enabled });
}

export function useCartCount(initial?: number) {
  return useQuery({
    queryKey: CART_COUNT_KEY,
    queryFn: () => api<{ count: number }>("/api/cart/count").then((r) => r.count),
    initialData: initial,
  });
}

function useCartMutation<TVars>(
  fn: (vars: TVars) => Promise<CartView>,
  opts: { successMessage?: string; openDrawer?: boolean; onDone?: (cart: CartView, vars: TVars) => void } = {},
) {
  const qc = useQueryClient();
  const ui = useCartUI();
  return useMutation({
    mutationFn: fn,
    onSuccess: (cart) => {
      qc.setQueryData(CART_KEY, cart);
      qc.setQueryData(CART_COUNT_KEY, cart.itemCount);
      if (opts.successMessage) toast.success(opts.successMessage);
      if (opts.openDrawer) ui.open();
    },
    onSettled: (cart, error, vars) => {
      if (cart && !error) opts.onDone?.(cart, vars as TVars);
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      void qc.invalidateQueries({ queryKey: CART_KEY });
    },
  });
}

export function useAddToCart(opts: { openDrawer?: boolean } = { openDrawer: true }) {
  const { currency } = useStore();
  return useCartMutation(
    (vars: { productId: string; variantId?: string; quantity: number }) => api<CartView>("/api/cart", { method: "POST", body: vars }),
    {
      openDrawer: opts.openDrawer,
      successMessage: opts.openDrawer ? undefined : "Added to your bag",
      onDone: (cart, vars) => {
        const line = cart.items.find((l) => l.productId === vars.productId && (!vars.variantId || l.variantId === vars.variantId));
        pixelTrack("AddToCart", {
          content_ids: [vars.productId],
          content_type: "product",
          content_name: line?.name,
          value: line ? Number(line.unitPrice) * vars.quantity : undefined,
          currency,
        });
      },
    },
  );
}

export function useUpdateCartItem() {
  return useCartMutation((vars: { itemId: string; quantity: number }) => api<CartView>("/api/cart", { method: "PATCH", body: vars }));
}

export function useRemoveCartItem() {
  return useCartMutation((itemId: string) => api<CartView>(`/api/cart/items/${itemId}`, { method: "DELETE" }), {
    successMessage: "Removed from your bag",
  });
}

export function useApplyCoupon() {
  return useCartMutation((code: string) => api<CartView>("/api/cart/coupon", { method: "POST", body: { code } }), {
    successMessage: "Coupon applied",
  });
}

export function useRemoveCoupon() {
  return useCartMutation(() => api<CartView>("/api/cart/coupon", { method: "DELETE" }));
}
