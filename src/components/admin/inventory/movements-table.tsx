import Link from "next/link";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToneBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import type { MovementRow } from "@/services/admin/inventory";

const TYPE_TONE = {
  INITIAL: "neutral",
  RESTOCK: "success",
  SALE: "info",
  ADJUSTMENT: "progress",
  RETURN: "success",
  CANCELLATION: "warning",
} as const;

export function MovementTypeBadge({ type }: { type: MovementRow["type"] }) {
  return <ToneBadge tone={TYPE_TONE[type]}>{type.charAt(0) + type.slice(1).toLowerCase()}</ToneBadge>;
}

/** Stock movement log table (works in server and client components). */
export function MovementsTable({ rows, showProduct }: { rows: MovementRow[]; showProduct?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4">Date</TableHead>
          {showProduct && <TableHead>Product</TableHead>}
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Change</TableHead>
          <TableHead className="text-right">After</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>By</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((m) => (
          <TableRow key={m.id}>
            <TableCell className="pl-4 text-xs whitespace-nowrap text-muted-foreground">{format(new Date(m.createdAt), "d MMM yyyy, HH:mm")}</TableCell>
            {showProduct && (
              <TableCell>
                <Link href={`/admin/products/${m.productId}`} className="text-sm hover:underline">
                  {m.productName}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {m.variantName ? `${m.variantName} · ` : ""}
                  {m.sku}
                </p>
              </TableCell>
            )}
            <TableCell>
              <MovementTypeBadge type={m.type} />
            </TableCell>
            <TableCell className={cn("text-right font-medium tabular-nums", m.quantityChange > 0 ? "text-success" : m.quantityChange < 0 ? "text-destructive" : "")}>
              {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
            </TableCell>
            <TableCell className="text-right tabular-nums">{m.quantityAfter}</TableCell>
            <TableCell className="max-w-56 text-sm">
              <span className="line-clamp-2">{m.reason ?? "—"}</span>
              {m.order && (
                <Link href={`/admin/orders/${m.order.id}`} className="text-xs text-clay hover:underline">
                  {m.order.orderNumber}
                </Link>
              )}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">{m.user ?? (m.order ? "Customer" : "System")}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
