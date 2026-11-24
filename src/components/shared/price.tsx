"use client";

import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useStore } from "@/components/shared/store-context";

export function Money({ value, className }: { value: string | number; className?: string }) {
  const { currency } = useStore();
  return <span className={className}>{formatMoney(value, currency)}</span>;
}

export function Price({
  price,
  salePrice,
  size = "md",
  className,
}: {
  price: string;
  salePrice?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { currency } = useStore();
  const onSale = salePrice !== null && salePrice !== undefined && Number(salePrice) < Number(price);
  const sizes = { sm: "text-sm", md: "text-[0.95rem]", lg: "text-2xl" };
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2", sizes[size], className)}>
      <span className={cn("font-medium tabular-nums", onSale && "text-clay")}>
        {formatMoney(onSale ? salePrice! : price, currency)}
      </span>
      {onSale && (
        <span className="text-[0.85em] text-muted-foreground tabular-nums line-through">{formatMoney(price, currency)}</span>
      )}
    </div>
  );
}
