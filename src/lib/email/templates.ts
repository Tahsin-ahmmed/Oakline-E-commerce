import "server-only";
import { formatMoney } from "@/lib/money";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function layout(siteName: string, title: string, bodyHtml: string) {
  return `<!doctype html><html><body style="margin:0;background:#f7f4ef;font-family:Helvetica,Arial,sans-serif;color:#2a2622">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6dfd4;border-radius:10px">
<tr><td style="padding:28px 32px 8px;font-family:Georgia,serif;font-size:22px;letter-spacing:.5px">${esc(siteName)}</td></tr>
<tr><td style="padding:8px 32px 32px;font-size:15px;line-height:1.6">
<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:22px;margin:8px 0 16px">${esc(title)}</h1>
${bodyHtml}
</td></tr></table>
<p style="font-size:12px;color:#8a8178;margin-top:16px">You are receiving this email because of activity on your ${esc(siteName)} account.</p>
</td></tr></table></body></html>`;
}

function button(href: string, label: string) {
  return `<p style="margin:24px 0"><a href="${esc(href)}" style="background:#2f2a25;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;display:inline-block">${esc(label)}</a></p>`;
}

export function verifyEmailTemplate(p: { siteName: string; name: string; url: string }) {
  return {
    subject: `Confirm your email for ${p.siteName}`,
    html: layout(
      p.siteName,
      "Confirm your email",
      `<p>Hi ${esc(p.name)},</p><p>Welcome! Please confirm your email address to secure your account.</p>${button(p.url, "Confirm email")}<p style="color:#8a8178;font-size:13px">This link expires in 24 hours.</p>`,
    ),
    text: `Hi ${p.name},\n\nConfirm your email: ${p.url}\n\nThis link expires in 24 hours.`,
  };
}

export function resetPasswordTemplate(p: { siteName: string; name: string; url: string }) {
  return {
    subject: `Reset your ${p.siteName} password`,
    html: layout(
      p.siteName,
      "Reset your password",
      `<p>Hi ${esc(p.name)},</p><p>We received a request to reset your password.</p>${button(p.url, "Choose a new password")}<p style="color:#8a8178;font-size:13px">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>`,
    ),
    text: `Hi ${p.name},\n\nReset your password: ${p.url}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
  };
}

interface OrderEmailData {
  siteName: string;
  orderNumber: string;
  customerName: string;
  currency: string;
  items: { productName: string; variantName: string | null; quantity: number; lineTotal: string }[];
  subtotal: string;
  discountTotal: string;
  shippingTotal: string;
  grandTotal: string;
  paymentMethod: string;
  trackUrl: string;
}

export function orderConfirmationTemplate(o: OrderEmailData) {
  const rows = o.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${esc(i.productName)}${i.variantName ? ` <span style="color:#8a8178">· ${esc(i.variantName)}</span>` : ""} × ${i.quantity}</td><td align="right">${formatMoney(i.lineTotal, o.currency)}</td></tr>`,
    )
    .join("");
  const totals = `<tr><td style="padding-top:12px;border-top:1px solid #eee">Subtotal</td><td align="right" style="padding-top:12px;border-top:1px solid #eee">${formatMoney(o.subtotal, o.currency)}</td></tr>
${Number(o.discountTotal) > 0 ? `<tr><td>Discount</td><td align="right">-${formatMoney(o.discountTotal, o.currency)}</td></tr>` : ""}
<tr><td>Shipping</td><td align="right">${Number(o.shippingTotal) === 0 ? "Free" : formatMoney(o.shippingTotal, o.currency)}</td></tr>
<tr><td style="font-weight:bold;padding-top:6px">Total</td><td align="right" style="font-weight:bold;padding-top:6px">${formatMoney(o.grandTotal, o.currency)}</td></tr>`;
  return {
    subject: `Order ${o.orderNumber} received — thank you!`,
    html: layout(
      o.siteName,
      "Thank you for your order",
      `<p>Hi ${esc(o.customerName)}, we've received order <strong>${esc(o.orderNumber)}</strong> and will let you know as it moves along.</p>
<table width="100%" style="font-size:14px">${rows}${totals}</table>
<p style="font-size:14px">Payment: ${esc(o.paymentMethod)}</p>${button(o.trackUrl, "Track your order")}`,
    ),
    text: `Hi ${o.customerName},\n\nWe've received order ${o.orderNumber}.\n\n${o.items
      .map((i) => `- ${i.productName}${i.variantName ? ` (${i.variantName})` : ""} x${i.quantity}: ${formatMoney(i.lineTotal, o.currency)}`)
      .join("\n")}\n\nTotal: ${formatMoney(o.grandTotal, o.currency)}\nPayment: ${o.paymentMethod}\n\nTrack your order: ${o.trackUrl}`,
  };
}

export function orderStatusTemplate(p: {
  siteName: string;
  orderNumber: string;
  customerName: string;
  statusLabel: string;
  note?: string | null;
  trackingNumber?: string | null;
  courier?: string | null;
  trackUrl: string;
}) {
  const tracking = p.trackingNumber
    ? `<p>Tracking: <strong>${esc(p.trackingNumber)}</strong>${p.courier ? ` via ${esc(p.courier)}` : ""}</p>`
    : "";
  return {
    subject: `Order ${p.orderNumber}: ${p.statusLabel}`,
    html: layout(
      p.siteName,
      `Your order is ${p.statusLabel.toLowerCase()}`,
      `<p>Hi ${esc(p.customerName)}, order <strong>${esc(p.orderNumber)}</strong> is now <strong>${esc(p.statusLabel)}</strong>.</p>${p.note ? `<p>${esc(p.note)}</p>` : ""}${tracking}${button(p.trackUrl, "View order")}`,
    ),
    text: `Hi ${p.customerName},\n\nOrder ${p.orderNumber} is now ${p.statusLabel}.${p.note ? `\n${p.note}` : ""}${p.trackingNumber ? `\nTracking: ${p.trackingNumber}` : ""}\n\n${p.trackUrl}`,
  };
}

export function adminAlertTemplate(p: { siteName: string; title: string; lines: string[]; url: string }) {
  return {
    subject: `[${p.siteName}] ${p.title}`,
    html: layout(p.siteName, p.title, `${p.lines.map((l) => `<p>${esc(l)}</p>`).join("")}${button(p.url, "Open in admin")}`),
    text: `${p.title}\n\n${p.lines.join("\n")}\n\n${p.url}`,
  };
}
