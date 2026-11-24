import "server-only";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { Decimal, moneyString } from "@/lib/money";
import { computeTotals } from "@/lib/pricing";
import { appUrl } from "@/lib/env";
import { getProvider } from "@/lib/payments/registry";
import { PAYMENT_METHOD_LABELS } from "@/lib/order-status";
import { sendMail } from "@/lib/email/mailer";
import { adminAlertTemplate, orderConfirmationTemplate } from "@/lib/email/templates";
import type { SessionUser } from "@/lib/auth/session";
import type { CheckoutInput } from "@/lib/validations/checkout";
import { getCurrentCartId, loadPricedLines } from "@/services/cart";
import { validateCoupon } from "@/services/coupons";
import { getShippingOptions } from "@/services/shipping";
import { reserveStock, syncProductStock } from "@/services/inventory";
import { getSettings } from "@/services/settings";
import { notifyAdmins } from "@/services/notifications";
import { env } from "@/lib/env";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateOrderNumber(prefix: string) {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  let suffix = "";
  for (let i = 0; i < 5; i++) suffix += ALPHABET[randomInt(ALPHABET.length)];
  return `${prefix}-${ymd}-${suffix}`;
}

export interface PlaceOrderResult {
  orderId: string;
  orderNumber: string;
  redirectUrl: string;
  duplicate: boolean;
}

async function existingByKey(key: string, email: string) {
  const order = await prisma.order.findUnique({ where: { idempotencyKey: key } });
  if (!order) return null;
  if (order.customerEmail !== email.toLowerCase()) throw conflict("This checkout session has already been used.");
  return order;
}

export async function placeOrder(input: CheckoutInput, user: SessionUser | null): Promise<PlaceOrderResult> {
  const email = input.customer.email.toLowerCase();

  // Idempotency: a repeated submission returns the original order instead of creating a duplicate.
  const prior = await existingByKey(input.idempotencyKey, email);
  if (prior) {
    return { orderId: prior.id, orderNumber: prior.orderNumber, redirectUrl: `/checkout/success?order=${prior.orderNumber}`, duplicate: true };
  }

  const settings = await getSettings();
  const provider = getProvider(input.paymentMethod);
  if (input.paymentMethod === "COD" && !settings.commerce.codEnabled) {
    throw badRequest("Cash on Delivery is currently unavailable.");
  }
  if (input.paymentMethod !== "COD" && !provider.isConfigured()) {
    throw badRequest(`${provider.label} is not available right now. Please choose another payment method.`);
  }

  const cartId = await getCurrentCartId();
  if (!cartId) throw badRequest("Your bag is empty.");

  let created;
  try {
    created = await prisma.$transaction(
      async (tx) => {
        const lines = await loadPricedLines(cartId, tx);
        if (!lines.length) throw badRequest("Your bag is empty.");
        const problems = lines.filter((l) => !l.purchasable);
        if (problems.length) {
          throw conflict("Some items in your bag need attention before you can check out.", {
            items: problems.map((p) => `${p.name}: ${p.warning}`),
          });
        }

        // Coupon — revalidated on the server inside the transaction.
        let discount = new Decimal(0);
        let freeShippingCoupon = false;
        let couponId: string | null = null;
        let couponCode: string | null = null;
        if (input.couponCode) {
          const result = await validateCoupon(
            input.couponCode,
            lines.map((l) => ({ productId: l.productId, categoryIds: l.categoryIds, lineTotal: l.lineTotal })),
            { userId: user?.id, email },
            tx,
          );
          if (!result.ok) throw badRequest(result.reason, { couponCode: [result.reason] });
          discount = result.discount;
          freeShippingCoupon = result.freeShipping;
          couponId = result.couponId ?? null;
          couponCode = result.code ?? null;
        }

        const pre = computeTotals({ lines: lines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity })), discount });
        const addr = input.shippingAddress;
        const options = await getShippingOptions(
          { division: addr.division, district: addr.district, area: addr.area },
          pre.subtotal.minus(pre.discount),
          { storeFreeThreshold: settings.commerce.freeShippingThreshold, freeShippingCoupon },
          tx,
        );
        const method = options.find((o) => o.id === input.shippingMethodId);
        if (!method) throw badRequest("The selected delivery method is not available for this address.", { shippingMethodId: ["Choose a delivery method"] });
        if (input.paymentMethod === "COD" && !method.codAvailable) {
          throw badRequest("Cash on Delivery is not available for this delivery method.");
        }

        const totals = computeTotals({
          lines: lines.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity })),
          discount,
          shipping: method.fee,
          taxRate: settings.commerce.taxEnabled ? settings.commerce.taxRate : 0,
          taxInclusive: settings.commerce.taxInclusive,
        });

        const order = await tx.order.create({
          data: {
            orderNumber: generateOrderNumber(settings.commerce.orderPrefix),
            userId: user?.id ?? null,
            status: "PENDING",
            paymentStatus: input.paymentMethod === "COD" ? "UNPAID" : "PENDING",
            paymentMethod: input.paymentMethod,
            currency: settings.general.currency,
            subtotal: totals.subtotal,
            discountTotal: totals.discount,
            shippingTotal: totals.shipping,
            taxTotal: totals.tax,
            grandTotal: totals.total,
            couponId,
            couponCode,
            customerName: input.customer.name,
            customerEmail: email,
            customerPhone: input.customer.phone,
            shipFullName: addr.fullName,
            shipPhone: addr.phone,
            shipLine1: addr.line1,
            shipLine2: addr.line2 || null,
            shipArea: addr.area || null,
            shipDistrict: addr.district,
            shipDivision: addr.division,
            shipPostalCode: addr.postalCode || null,
            shippingMethodId: method.id,
            shippingMethodName: method.name,
            estimatedDelivery: method.estimate,
            customerNote: input.note || null,
            idempotencyKey: input.idempotencyKey,
            items: {
              create: lines.map((l) => ({
                productId: l.productId,
                variantId: l.variantId,
                productName: l.name,
                variantName: l.variantName,
                sku: l.sku,
                imageUrl: l.image,
                unitPrice: l.unitPrice,
                quantity: l.quantity,
                lineTotal: l.lineTotal,
              })),
            },
            statusHistory: { create: { toStatus: "PENDING", note: "Order placed", changedById: user?.id ?? null } },
            payments: {
              create: {
                method: input.paymentMethod,
                status: input.paymentMethod === "COD" ? "UNPAID" : "PENDING",
                amount: totals.total,
                currency: settings.general.currency,
                provider: input.paymentMethod === "STRIPE" ? "stripe" : input.paymentMethod.toLowerCase(),
              },
            },
          },
          include: { items: true, payments: true },
        });

        // Snapshot unit costs for margin reporting (admin only).
        const costs = await tx.product.findMany({
          where: { id: { in: lines.map((l) => l.productId) } },
          select: { id: true, costPrice: true },
        });
        for (const item of order.items) {
          const cost = costs.find((c) => c.id === item.productId)?.costPrice;
          if (cost) await tx.orderItem.update({ where: { id: item.id }, data: { unitCost: cost } });
        }

        // Reserve stock atomically (throws and rolls back everything if any line is short).
        for (const l of lines) {
          await reserveStock(tx, { variantId: l.variantId, quantity: l.quantity, orderId: order.id, productName: l.name });
        }
        const productIds = [...new Set(lines.map((l) => l.productId))];
        for (const pid of productIds) {
          const qty = lines.filter((l) => l.productId === pid).reduce((n, l) => n + l.quantity, 0);
          await tx.product.update({ where: { id: pid }, data: { soldCount: { increment: qty } } });
          await syncProductStock(tx, pid);
        }

        if (couponId) {
          // Conditional increment closes the race between two customers using the last coupon slot.
          const updated = await tx.$executeRaw`
            UPDATE "Coupon" SET "usedCount" = "usedCount" + 1, "updatedAt" = now()
            WHERE "id" = ${couponId} AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`;
          if (updated !== 1) throw conflict("This coupon has just reached its usage limit.");
          await tx.couponUsage.create({
            data: { couponId, userId: user?.id ?? null, email, orderId: order.id, discountAmount: totals.discount },
          });
        }

        await tx.cartItem.deleteMany({ where: { cartId } });
        await tx.cart.update({ where: { id: cartId }, data: { couponCode: null } });

        if (user && input.saveAddress) {
          const count = await tx.address.count({ where: { userId: user.id } });
          const duplicate = await tx.address.findFirst({
            where: { userId: user.id, line1: addr.line1, district: addr.district, phone: addr.phone },
          });
          if (!duplicate && count < 10) {
            await tx.address.create({
              data: {
                userId: user.id,
                label: addr.label || null,
                fullName: addr.fullName,
                phone: addr.phone,
                line1: addr.line1,
                line2: addr.line2 || null,
                area: addr.area || null,
                district: addr.district,
                division: addr.division,
                postalCode: addr.postalCode || null,
                isDefault: count === 0,
              },
            });
          }
        }
        return order;
      },
      { timeout: 20_000, maxWait: 10_000 },
    );
  } catch (error) {
    // Two concurrent submissions with the same key: return the one that won.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const winner = await existingByKey(input.idempotencyKey, email);
      if (winner) {
        return { orderId: winner.id, orderNumber: winner.orderNumber, redirectUrl: `/checkout/success?order=${winner.orderNumber}`, duplicate: true };
      }
    }
    throw error;
  }

  let redirectUrl = `/checkout/success?order=${encodeURIComponent(created.orderNumber)}`;

  if (provider.isOnline) {
    redirectUrl = await startOnlinePayment(created.id);
  } else {
    await sendOrderEmails(created.id);
  }
  await notifyAdmins({
    type: "order.created",
    title: `New order ${created.orderNumber}`,
    body: `${created.customerName} · ${PAYMENT_METHOD_LABELS[created.paymentMethod]} · ${moneyString(created.grandTotal)} ${created.currency}`,
    link: `/admin/orders/${created.id}`,
  });
  return { orderId: created.id, orderNumber: created.orderNumber, redirectUrl, duplicate: false };
}

/** Create (or re-create) a hosted payment session for an unpaid online order. */
export async function startOnlinePayment(orderId: string): Promise<string> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!order) throw notFound("Order not found.");
  if (order.paymentStatus === "PAID") return `/checkout/success?order=${encodeURIComponent(order.orderNumber)}`;
  if (order.status !== "PENDING") throw badRequest("This order can no longer be paid online.");
  const provider = getProvider(order.paymentMethod);
  if (!provider.isOnline || !provider.isConfigured()) throw badRequest("Online payment is not available for this order.");

  let payment = order.payments[0];
  if (!payment || payment.status === "FAILED" || payment.status === "CANCELLED" || payment.providerReference) {
    payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        method: order.paymentMethod,
        status: "PENDING",
        amount: order.grandTotal,
        currency: order.currency,
        provider: order.paymentMethod === "STRIPE" ? "stripe" : order.paymentMethod.toLowerCase(),
      },
    });
  }
  try {
    const result = await provider.initiate(
      {
        id: order.id,
        orderNumber: order.orderNumber,
        grandTotal: moneyString(order.grandTotal),
        currency: order.currency,
        customerEmail: order.customerEmail,
        shippingTotal: moneyString(order.shippingTotal),
        discountTotal: moneyString(order.discountTotal),
        items: order.items.map((i) => ({
          productName: i.productName,
          variantName: i.variantName,
          quantity: i.quantity,
          unitPrice: moneyString(i.unitPrice),
          imageUrl: i.imageUrl,
        })),
      },
      payment.id,
    );
    await prisma.payment.update({
      where: { id: payment.id },
      data: { providerReference: result.providerReference ?? null },
    });
    return result.redirectUrl ?? `/checkout/success?order=${encodeURIComponent(order.orderNumber)}`;
  } catch (error) {
    console.error("[checkout] payment initiation failed", error);
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", failureReason: "Could not start payment session" },
    });
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "FAILED" } });
    throw badRequest(
      "We couldn't start the payment. Your order is saved — you can retry payment from your order page.",
    );
  }
}

/** Order confirmation to the customer + alert to the store. Failures are logged, not thrown. */
export async function sendOrderEmails(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return;
  const { general } = await getSettings();
  const mail = orderConfirmationTemplate({
    siteName: general.siteName,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    currency: order.currency,
    items: order.items.map((i) => ({
      productName: i.productName,
      variantName: i.variantName,
      quantity: i.quantity,
      lineTotal: moneyString(i.lineTotal),
    })),
    subtotal: moneyString(order.subtotal),
    discountTotal: moneyString(order.discountTotal),
    shippingTotal: moneyString(order.shippingTotal),
    grandTotal: moneyString(order.grandTotal),
    paymentMethod: PAYMENT_METHOD_LABELS[order.paymentMethod],
    trackUrl: appUrl(`/track-order?order=${encodeURIComponent(order.orderNumber)}&email=${encodeURIComponent(order.customerEmail)}`),
  });
  await sendMail({ to: order.customerEmail, ...mail });
  const adminEmail = env().ADMIN_NOTIFICATION_EMAIL;
  if (adminEmail) {
    const alert = adminAlertTemplate({
      siteName: general.siteName,
      title: `New order ${order.orderNumber}`,
      lines: [
        `${order.customerName} (${order.customerEmail}, ${order.customerPhone})`,
        `${order.items.length} item(s) · ${PAYMENT_METHOD_LABELS[order.paymentMethod]}`,
        `Total: ${moneyString(order.grandTotal)} ${order.currency}`,
      ],
      url: appUrl(`/admin/orders/${order.id}`),
    });
    await sendMail({ to: adminEmail, ...alert });
  }
}
