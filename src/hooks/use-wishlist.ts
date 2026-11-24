"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import { useStore } from "@/components/shared/store-context";

export const WISHLIST_IDS_KEY = ["wishlist-ids"] as const;

export function useWishlistIds() {
  const { user } = useStore();
  return useQuery({
    queryKey: WISHLIST_IDS_KEY,
    queryFn: () => api<string[]>("/api/wishlist?ids=1"),
    enabled: Boolean(user),
    initialData: user ? undefined : [],
  });
}

/** Toggle a product in the wishlist. Signed-out visitors are sent to sign in first. */
export function useToggleWishlist() {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useStore();
  const mutation = useMutation({
    mutationFn: ({ productId, add }: { productId: string; add: boolean }) =>
      add
        ? api<string[]>("/api/wishlist", { method: "POST", body: { productId } })
        : api<string[]>(`/api/wishlist/${productId}`, { method: "DELETE" }),
    onMutate: async ({ productId, add }) => {
      await qc.cancelQueries({ queryKey: WISHLIST_IDS_KEY });
      const prev = qc.getQueryData<string[]>(WISHLIST_IDS_KEY) ?? [];
      qc.setQueryData(WISHLIST_IDS_KEY, add ? [...new Set([...prev, productId])] : prev.filter((id) => id !== productId));
      return { prev };
    },
    onSuccess: (ids, { add }) => {
      qc.setQueryData(WISHLIST_IDS_KEY, ids);
      void qc.invalidateQueries({ queryKey: ["wishlist-products"] });
      toast.success(add ? "Saved to your wishlist" : "Removed from your wishlist");
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(WISHLIST_IDS_KEY, ctx.prev);
      toast.error(errorMessage(e));
    },
  });
  return {
    ...mutation,
    toggle(productId: string, currentlySaved: boolean) {
      if (!user) {
        toast.info("Sign in to save items to your wishlist.");
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      mutation.mutate({ productId, add: !currentlySaved });
    },
  };
}
