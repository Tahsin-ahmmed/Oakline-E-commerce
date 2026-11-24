import { route } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { getAdminOrder } from "@/services/admin/orders";
import { renderInvoicePdf } from "@/services/admin/invoice";

/** GET /api/admin/orders/:id/invoice.pdf — downloadable PDF invoice. */
export const GET = route<{ id: string }>({ auth: "staff", permission: "orders.view" }, async ({ params, req }) => {
  const order = await getAdminOrder(params.id);
  if (!order) throw notFound("Order not found.");
  const bytes = await renderInvoicePdf(order);
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="invoice-${order.orderNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
});
