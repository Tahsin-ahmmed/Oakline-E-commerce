import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { format } from "date-fns";
import { dec } from "@/lib/money";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/order-status";
import { getSettings } from "@/services/settings";
import type { AdminOrderDetail } from "@/services/admin/orders";

/** Standard PDF fonts only support WinAnsi; replace common Unicode punctuation and drop the rest. */
export function pdfSafe(input: string | null | undefined): string {
  return (input ?? "")
    .replace(/৳/g, "BDT ")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/×/g, "x")
    .replace(/…/g, "...")
    .replace(/[·•]/g, "-")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

/** Currency formatting for PDFs (ASCII code instead of symbol). */
export function pdfMoney(value: { toString(): string } | string | number, currency: string) {
  const n = dec(value).toDecimalPlaces(2);
  const locale = currency === "BDT" || currency === "INR" ? "en-IN" : "en-US";
  const s = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n.toNumber()));
  return `${n.isNegative() ? "-" : ""}${currency} ${s}`;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = pdfSafe(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function renderInvoicePdf(order: AdminOrderDetail): Promise<Uint8Array> {
  const { general } = await getSettings();
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${order.orderNumber}`);
  pdf.setAuthor(pdfSafe(general.siteName));
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.16, 0.15, 0.13);
  const muted = rgb(0.45, 0.42, 0.38);
  const line = rgb(0.88, 0.86, 0.82);
  const W = 595.28;
  const H = 841.89;
  const M = 48;
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;

  const text = (s: string, x: number, size = 10, f = font, color = ink) => page.drawText(pdfSafe(s), { x, y, size, font: f, color });
  const right = (s: string, xRight: number, size = 10, f = font, color = ink) => {
    const t = pdfSafe(s);
    page.drawText(t, { x: xRight - f.widthOfTextAtSize(t, size), y, size, font: f, color });
  };
  const newPageIfNeeded = (needed: number) => {
    if (y - needed < M + 40) {
      page = pdf.addPage([W, H]);
      y = H - M;
    }
  };

  // Header
  text(general.siteName, M, 22, bold);
  right("INVOICE", W - M, 18, bold);
  y -= 18;
  for (const l of wrap(general.address, font, 9, 260)) {
    text(l, M, 9, font, muted);
    y -= 12;
  }
  text([general.phone, general.contactEmail].filter(Boolean).join("  |  "), M, 9, font, muted);
  y += 12 * (wrap(general.address, font, 9, 260).length);
  right(`Invoice no. ${order.orderNumber}`, W - M, 10);
  y -= 14;
  right(`Date: ${format(order.placedAt, "d MMM yyyy")}`, W - M, 10, font, muted);
  y -= 14;
  right(`Status: ${ORDER_STATUS_LABELS[order.status]}`, W - M, 10, font, muted);
  y -= 40;

  // Addresses
  const colX = W / 2 + 10;
  text("BILL TO", M, 8, bold, muted);
  page.drawText("SHIP TO", { x: colX, y, size: 8, font: bold, color: muted });
  y -= 14;
  const bill = [order.customerName, order.customerEmail, order.customerPhone];
  const ship = [
    order.shipFullName,
    order.shipLine1,
    order.shipLine2,
    [order.shipArea, order.shipDistrict].filter(Boolean).join(", "),
    [order.shipDivision, order.shipPostalCode, order.shipCountry].filter(Boolean).join(" "),
    order.shipPhone,
  ].filter((s): s is string => Boolean(s));
  const rows = Math.max(bill.length, ship.length);
  for (let i = 0; i < rows; i++) {
    if (bill[i]) text(bill[i], M, 10);
    if (ship[i]) page.drawText(pdfSafe(ship[i]), { x: colX, y, size: 10, font, color: ink });
    y -= 14;
  }
  y -= 18;

  // Items table
  const cols = { item: M, qty: W - M - 190, unit: W - M - 90, total: W - M };
  const drawHead = () => {
    page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 20, color: rgb(0.96, 0.95, 0.93) });
    text("ITEM", cols.item + 6, 8, bold, muted);
    right("QTY", cols.qty, 8, bold, muted);
    right("UNIT PRICE", cols.unit, 8, bold, muted);
    right("TOTAL", cols.total - 6, 8, bold, muted);
    y -= 24;
  };
  drawHead();
  for (const item of order.items) {
    const nameLines = wrap(`${item.productName}${item.variantName ? ` - ${item.variantName}` : ""}`, font, 10, cols.qty - cols.item - 60);
    newPageIfNeeded(14 * nameLines.length + 20);
    const top = y;
    nameLines.forEach((l, i) => {
      y = top - i * 13;
      text(l, cols.item + 6, 10);
    });
    y = top - nameLines.length * 13;
    text(`SKU ${item.sku}`, cols.item + 6, 8, font, muted);
    y = top;
    right(String(item.quantity), cols.qty, 10);
    right(pdfMoney(item.unitPrice, order.currency), cols.unit, 10);
    right(pdfMoney(item.lineTotal, order.currency), cols.total - 6, 10);
    y = top - nameLines.length * 13 - 16;
    page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.5, color: line });
  }
  y -= 8;

  // Totals
  newPageIfNeeded(120);
  const totals: [string, string, boolean?][] = [
    ["Subtotal", pdfMoney(order.subtotal, order.currency)],
    ...(dec(order.discountTotal).gt(0)
      ? ([[`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`, `-${pdfMoney(order.discountTotal, order.currency)}`]] as [string, string][])
      : []),
    [`Shipping (${order.shippingMethodName})`, dec(order.shippingTotal).isZero() ? "Free" : pdfMoney(order.shippingTotal, order.currency)],
    ...(dec(order.taxTotal).gt(0) ? ([["Tax", pdfMoney(order.taxTotal, order.currency)]] as [string, string][]) : []),
    ["Total", pdfMoney(order.grandTotal, order.currency), true],
  ];
  for (const [label, value, strong] of totals) {
    if (strong) {
      page.drawLine({ start: { x: W / 2, y: y + 12 }, end: { x: W - M, y: y + 12 }, thickness: 0.8, color: ink });
    }
    right(label, W - M - 130, strong ? 11 : 10, strong ? bold : font, strong ? ink : muted);
    right(value, W - M - 6, strong ? 11 : 10, strong ? bold : font);
    y -= strong ? 20 : 16;
  }
  y -= 16;
  text(`Payment method: ${PAYMENT_METHOD_LABELS[order.paymentMethod]}`, M, 10);
  y -= 14;
  text(`Payment status: ${PAYMENT_STATUS_LABELS[order.paymentStatus]}`, M, 10);
  y -= 30;
  text(`Thank you for shopping with ${general.siteName}.`, M, 10, font, muted);

  // Footer on every page
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const label = `${pdfSafe(general.siteName)} - Invoice ${order.orderNumber} - Page ${i + 1} of ${pages.length}`;
    p.drawText(label, { x: M, y: 28, size: 8, font, color: muted });
  });
  return pdf.save();
}
