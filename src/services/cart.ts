import "server-only";
import { cookies } from "next/headers";
import { prisma, type Tx } from "@/lib/prisma";
import { generateToken, hashToken } from "@/lib/auth/crypto";
import { getCurrentUser } from "@/lib/auth/session";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { Decimal, moneyString } from "@/lib/money";
import { computeTotals, lineTotal, resolvePrice } from "@/lib/pricing";
import { validateCoupon } from "@/services/coupons";
import { getShippingOptions } from "@/services/shipping";
import { getSettings } from "@/services/settings";

export const CART_COOKIE = "oak_cart";
const GUEST_CART_DAYS = 60;

// ───────────── Identity ─────────────

async function findCurrentCart(db: Tx | typeof prisma = prisma) {
  const user = await getCurrentUser();
  if (user) return db.cart.findUnique({ where: { userId: user.id } });
  const token = (await cookies()).get(CART_COOKIE)?.value;
  if (!token || token.length > 200) return null;
  return db.cart.findUnique({ where: { guestToken: hashToken(token) } });
}

/** Get or create the current visitor's cart. Sets the guest cookie when needed (mutation contexts only). */
async function getOrCreateCart() {
  const user = await getCurrentUser();
  if (user) {
    return prisma.cart.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
  }
  const jar = await cookies();
  const existingToken = jar.get(CART_COOKIE)?.value;
  if (existingToken && existingToken.length <= 200) {
    const cart = await prisma.cart.findUnique({ where: { guestToken: hashToken(existingToken) } });
    if (cart) return cart;
  }
  const token = generateToken();
  const cart = await prisma.cart.create({ data: { guestToken: hashToken(token) } });
  jar.set(CART_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GUEST_CART_DAYS * 86_400,
  });
  return cart;
}

/** Move a guest cart's items into the user's cart after sign-in / registration. */
export async function mergeGuestCartIntoUser(userId: string) {
  const jar = await cookies();
  const token = jar.get(CART_COOKIE)?.value;
  if (!token) return;
  const guest = await prisma.cart.findUnique({ where: { guestToken: hashToken(token) }, include: { items: true } });
  jar.delete(CART_COOKIE);
  if (!guest) return;
  await prisma.$transaction(async (tx) => {
    const userCart = await tx.cart.upsert({ where: { userId }, create: { userId }, update: {} });
    for (const item of guest.items) {
      const existing = await tx.cartItem.findUnique({
        where: { cartId_variantId: { cartId: userCart.id, variantId: item.variantId } },
      });
      if (existing) {
        await tx.cartItem.update({
          where: { id: existing.id },
          data: { quantity: Math.min(99, Math.max(existing.quantity, item.quantity)) },
        });
      } else {
        await tx.cartItem.create({
          data: { cartId: userCart.id, productId: item.productId, variantId: item.variantId, quantity: item.quantity },
        });
      }
    }
    if (guest.couponCode && !userCart.couponCode) {
      await tx.cart.update({ where: { id: userCart.id }, data: { couponCode: guest.couponCode } });
    }
    await tx.cart.delete({ where: { id: guest.id } });
  });
}

// ───────────── Pricing ─────────────

const cartItemInclude = {
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      salePrice: true,
      status: true,
      deletedAt: true,
      categoryId: true,
      category: { select: { parentId: true, isActive: true } },
      extraCategories: { select: { categoryId: true } },
      images: { select: { url: true }, orderBy: { sortOrder: "asc" as const }, take: 1 },
    },
  },
  variant: {
    select: {
      id: true,
      sku: true,
      name: true,
      color: true,
      size: true,
      price: true,
      salePrice: true,
      imageUrl: true,
      isActive: true,
      isDefault: true,
      inventory: { select: { quantity: true } },
    },
  },
} as const;

export interface CartLine {
  id: string;
  productId: string;
  variantId: string;
  name: string;
  slug: string;
  variantName: string | null;
  sku: string;
  image: string | null;
  unitPrice: string;
  regularPrice: string;
  quantity: number;
  lineTotal: string;
  available: number;
  purchasable: boolean;
  warning: string | null;
  categoryIds: string[];
}

export function variantLabel(v: { name: string; color: string | null; size: string | null; isDefault?: boolean }) {
  const parts = [v.color, v.size].filter(Boolean);
  if (parts.length) return parts.join(" / ");
  return v.isDefault || v.name === "Default" ? null : v.name;
}

/** Load and price the items of a cart from the database (never from client input). */
export async function loadPricedLines(cartId: string, db: Tx | typeof prisma = prisma): Promise<CartLine[]> {
  const items = await db.cartItem.findMany({
    where: { cartId },
    include: cartItemInclude,
    orderBy: { createdAt: "asc" },
  });
  return items.map((item) => {
    const { product, variant } = item;
    const price = resolvePrice(product, variant);
    const available = Math.max(0, variant.inventory?.quantity ?? 0);
    const visible = product.status === "ACTIVE" && !product.deletedAt && product.category.isActive && variant.isActive;
    let warning: string | null = null;
    if (!visible) warning = "This item is no longer available.";
    else if (available <= 0) warning = "Out of stock.";
    else if (item.quantity > available) warning = `Only ${available} left in stock. Please reduce the quantity.`;
    return {
      id: item.id,
      productId: product.id,
      variantId: variant.id,
      name: product.name,
      slug: product.slug,
      variantName: variantLabel(variant),
      sku: variant.sku,
      image: variant.imageUrl ?? product.images[0]?.url ?? null,
      unitPrice: moneyString(price.effective),
      regularPrice: moneyString(price.regular),
      quantity: item.quantity,
      lineTotal: moneyString(lineTotal(price.effective, item.quantity)),
      available,
      purchasable: visible && available > 0 && item.quantity <= available,
      warning,
      categoryIds: [
        product.categoryId,
        ...(product.category.parentId ? [product.category.parentId] : []),
        ...product.extraCategories.map((c) => c.categoryId),
      ],
    };
  });
}

export interface CartView {
  id: string | null;
  items: CartLine[];
  itemCount: number;
  subtotal: string;
  discount: string;
  couponCode: string | null;
  couponMessage: string | null;
  freeShippingCoupon: boolean;
  shippingEstimate: { fee: string; label: string; isFree: boolean } | null;
  freeShippingThreshold: string | null;
  estimatedTotal: string;
  hasIssues: boolean;
}

const EMPTY_CART: CartView = {
  id: null,
  items: [],
  itemCount: 0,
  subtotal: "0.00",
  discount: "0.00",
  couponCode: null,
  couponMessage: null,
  freeShippingCoupon: false,
  shippingEstimate: null,
  freeShippingThreshold: null,
  estimatedTotal: "0.00",
  hasIssues: false,
};

export async function getCartView(): Promise<CartView> {
  const cart = await findCurrentCart();
  if (!cart) return EMPTY_CART;
  const [lines, settings, user] = await Promise.all([loadPricedLines(cart.id), getSettings(), getCurrentUser()]);
  if (!lines.length) return { ...EMPTY_CART, id: cart.id };

  const purchasable = lines.filter((l) => l.purchasable);
  const subtotal = computeTotals({ lines: purchasable.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity })) }).subtotal;

  let discount = new Decimal(0);
  let couponMessage: string | null = null;
  let freeShippingCoupon = false;
  let couponCode = cart.couponCode;
  if (couponCode) {
    const result = await validateCoupon(
      couponCode,
      purchasable.map((l) => ({ productId: l.productId, categoryIds: l.categoryIds, lineTotal: l.lineTotal })),
      { userId: user?.id, email: user?.email },
    );
    if (result.ok) {
      discount = result.discount;
      freeShippingCoupon = result.freeShipping;
    } else {
      couponMessage = result.reason;
      couponCode = cart.couponCode;
    }
  }

  // Shipping estimate: the customer's default address, otherwise the store's default zone.
  const defaultAddress = user
    ? await prisma.address.findFirst({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] })
    : null;
  const afterDiscount = subtotal.minus(discount);
  const options = await getShippingOptions(
    defaultAddress
      ? { division: defaultAddress.division, district: defaultAddress.district, area: defaultAddress.area }
      : { division: "Dhaka", district: "Dhaka" },
    afterDiscount,
    { storeFreeThreshold: settings.commerce.freeShippingThreshold, freeShippingCoupon },
  );
  const cheapest = [...options].sort((a, b) => Number(a.fee) - Number(b.fee))[0];
  const shippingEstimate = cheapest
    ? {
        fee: cheapest.fee,
        isFree: cheapest.isFree,
        label: defaultAddress ? `${cheapest.name} to ${defaultAddress.district}` : `${cheapest.name} (estimate)`,
      }
    : null;

  const totals = computeTotals({
    lines: purchasable.map((l) => ({ unitPrice: l.unitPrice, quantity: l.quantity })),
    discount,
    shipping: shippingEstimate?.fee ?? 0,
    taxRate: settings.commerce.taxEnabled ? settings.commerce.taxRate : 0,
    taxInclusive: settings.commerce.taxInclusive,
  });

  return {
    id: cart.id,
    items: lines,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal: moneyString(totals.subtotal),
    discount: moneyString(totals.discount),
    couponCode,
    couponMessage,
    freeShippingCoupon,
    shippingEstimate,
    freeShippingThreshold:
      settings.commerce.freeShippingThreshold > 0 ? moneyString(settings.commerce.freeShippingThreshold) : null,
    estimatedTotal: moneyString(totals.total),
    hasIssues: lines.some((l) => !l.purchasable),
  };
}

/** Lightweight item count for the header badge. */
export async function getCartCount() {
  const cart = await findCurrentCart();
  if (!cart) return 0;
  const agg = await prisma.cartItem.aggregate({ where: { cartId: cart.id }, _sum: { quantity: true } });
  return agg._sum.quantity ?? 0;
}

// ───────────── Mutations ─────────────

async function resolveVariant(productId: string, variantId?: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, status: "ACTIVE", deletedAt: null, category: { isActive: true } },
    select: {
      id: true,
      name: true,
      hasVariants: true,
      variants: { where: { isActive: true }, include: { inventory: true }, orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }] },
    },
  });
  if (!product) throw notFound("This product is no longer available.");
  let variant;
  if (variantId) {
    variant = product.variants.find((v) => v.id === variantId);
    if (!variant) throw badRequest("The selected option is not available for this product.");
  } else {
    if (product.hasVariants && product.variants.length > 1) {
      throw badRequest("Please choose a colour or size before adding to your bag.");
    }
    variant = product.variants[0];
    if (!variant) throw badRequest("This product is not available for purchase.");
  }
  return { product, variant, available: Math.max(0, variant.inventory?.quantity ?? 0) };
}

export async function addToCart(productId: string, variantId: string | undefined, quantity: number) {
  const { product, variant, available } = await resolveVariant(productId, variantId);
  if (available <= 0) throw conflict(`"${product.name}" is out of stock.`);
  const cart = await getOrCreateCart();
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
  });
  const desired = (existing?.quantity ?? 0) + quantity;
  if (desired > available) {
    throw conflict(
      existing
        ? `You already have ${existing.quantity} in your bag — only ${available} available.`
        : `Only ${available} available.`,
    );
  }
  if (desired > 99) throw badRequest("You can buy at most 99 of an item per order.");
  await prisma.cartItem.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
    create: { cartId: cart.id, productId: product.id, variantId: variant.id, quantity },
    update: { quantity: desired },
  });
  await prisma.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });
}

async function ownedItem(itemId: string) {
  const cart = await findCurrentCart();
  if (!cart) throw notFound("Your bag is empty.");
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cartId: cart.id },
    include: { variant: { include: { inventory: true } }, product: { select: { name: true } } },
  });
  if (!item) throw notFound("That item is no longer in your bag.");
  return { cart, item };
}

export async function updateCartItem(itemId: string, quantity: number) {
  const { item } = await ownedItem(itemId);
  if (quantity === 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
    return;
  }
  const available = Math.max(0, item.variant.inventory?.quantity ?? 0);
  if (quantity > available) {
    throw conflict(
      available > 0 ? `Only ${available} of "${item.product.name}" available.` : `"${item.product.name}" is out of stock.`,
    );
  }
  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
}

export async function removeCartItem(itemId: string) {
  const { item } = await ownedItem(itemId);
  await prisma.cartItem.delete({ where: { id: item.id } });
}

export async function applyCartCoupon(code: string) {
  const cart = await findCurrentCart();
  if (!cart) throw badRequest("Add something to your bag before applying a coupon.");
  const user = await getCurrentUser();
  const lines = (await loadPricedLines(cart.id)).filter((l) => l.purchasable);
  const result = await validateCoupon(
    code,
    lines.map((l) => ({ productId: l.productId, categoryIds: l.categoryIds, lineTotal: l.lineTotal })),
    { userId: user?.id, email: user?.email },
  );
  if (!result.ok) throw badRequest(result.reason, { code: [result.reason] });
  await prisma.cart.update({ where: { id: cart.id }, data: { couponCode: result.code } });
  return { code: result.code, discount: moneyString(result.discount), freeShipping: result.freeShipping };
}

export async function removeCartCoupon() {
  const cart = await findCurrentCart();
  if (cart) await prisma.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
}

export async function getCurrentCartId() {
  return (await findCurrentCart())?.id ?? null;
}
