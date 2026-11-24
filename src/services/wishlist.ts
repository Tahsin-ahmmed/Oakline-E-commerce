import "server-only";
import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import { productCardSelect, toCard, visibleProduct } from "@/services/catalog";

async function wishlistFor(userId: string) {
  return prisma.wishlist.upsert({ where: { userId }, create: { userId }, update: {} });
}

export async function getWishlistProductIds(userId: string): Promise<string[]> {
  const items = await prisma.wishlistItem.findMany({ where: { wishlist: { userId } }, select: { productId: true } });
  return items.map((i) => i.productId);
}

export async function getWishlistProducts(userId: string) {
  const items = await prisma.wishlistItem.findMany({
    where: { wishlist: { userId }, product: visibleProduct },
    orderBy: { createdAt: "desc" },
    include: { product: { select: productCardSelect } },
  });
  return items.map((i) => toCard(i.product));
}

export async function addToWishlist(userId: string, productId: string) {
  const product = await prisma.product.findFirst({ where: { id: productId, ...visibleProduct }, select: { id: true } });
  if (!product) throw notFound("This product is no longer available.");
  const wishlist = await wishlistFor(userId);
  await prisma.wishlistItem.upsert({
    where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
    create: { wishlistId: wishlist.id, productId },
    update: {},
  });
}

export async function removeFromWishlist(userId: string, productId: string) {
  await prisma.wishlistItem.deleteMany({ where: { productId, wishlist: { userId } } });
}
