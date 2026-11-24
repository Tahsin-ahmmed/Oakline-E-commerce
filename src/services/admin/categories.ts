import "server-only";
import { prisma } from "@/lib/prisma";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { revalidateCatalog } from "@/services/admin/products";
import type { AttributeInput, BrandInput, CategoryInput } from "@/lib/validations/admin/catalog";

// ───────────── Categories ─────────────

export async function listCategoryTree() {
  const [cats, primaryCounts] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.product.groupBy({ by: ["categoryId"], where: { deletedAt: null }, _count: true }),
  ]);
  const count = new Map(primaryCounts.map((c) => [c.categoryId, c._count]));
  const toNode = (c: (typeof cats)[number]) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    parentId: c.parentId,
    description: c.description,
    imageUrl: c.imageUrl,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    seoTitle: c.seoTitle,
    seoDescription: c.seoDescription,
    productCount: count.get(c.id) ?? 0,
  });
  const parents = cats.filter((c) => !c.parentId).map((p) => {
    const children = cats.filter((c) => c.parentId === p.id).map(toNode);
    const node = toNode(p);
    return { ...node, children, totalProducts: node.productCount + children.reduce((n, c) => n + c.productCount, 0) };
  });
  return parents;
}
export type CategoryTreeNode = Awaited<ReturnType<typeof listCategoryTree>>[number];

async function validateParent(parentId: string | null | undefined, selfId?: string) {
  if (!parentId) return null;
  if (parentId === selfId) throw badRequest("A category cannot be its own parent.", { parentId: ["Invalid parent"] });
  const parent = await prisma.category.findUnique({ where: { id: parentId } });
  if (!parent) throw badRequest("Parent category not found.", { parentId: ["Not found"] });
  if (parent.parentId) throw badRequest("Subcategories can only be placed under a top-level category.", { parentId: ["Choose a top-level category"] });
  if (selfId) {
    const children = await prisma.category.count({ where: { parentId: selfId } });
    if (children > 0) throw badRequest("This category has subcategories, so it must stay top-level.", { parentId: ["Has subcategories"] });
  }
  return parent.id;
}

async function assertSlugFree(slug: string, selfId?: string) {
  const taken = await prisma.category.findFirst({ where: { slug, id: selfId ? { not: selfId } : undefined } });
  if (taken) throw conflict("This slug is already used.", { slug: ["Slug already in use"] });
}

function categoryData(input: CategoryInput) {
  return {
    name: input.name,
    slug: input.slug,
    description: input.description || null,
    imageUrl: input.imageUrl || null,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
  };
}

export async function createCategory(input: CategoryInput) {
  await assertSlugFree(input.slug);
  const parentId = await validateParent(input.parentId);
  const c = await prisma.category.create({ data: { ...categoryData(input), parentId } });
  revalidateCatalog();
  return c;
}

export async function updateCategory(id: string, input: CategoryInput) {
  const current = await prisma.category.findUnique({ where: { id } });
  if (!current) throw notFound("Category not found.");
  await assertSlugFree(input.slug, id);
  const parentId = await validateParent(input.parentId, id);
  const c = await prisma.category.update({ where: { id }, data: { ...categoryData(input), parentId } });
  revalidateCatalog();
  return c;
}

export async function patchCategory(id: string, patch: { isActive?: boolean; move?: "up" | "down" }) {
  const current = await prisma.category.findUnique({ where: { id } });
  if (!current) throw notFound("Category not found.");
  if (patch.isActive !== undefined) {
    await prisma.category.update({ where: { id }, data: { isActive: patch.isActive } });
  }
  if (patch.move) {
    // Normalise sibling order, then swap with the neighbour.
    await prisma.$transaction(async (tx) => {
      const siblings = await tx.category.findMany({
        where: { parentId: current.parentId },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true },
      });
      const ids = siblings.map((s) => s.id);
      const i = ids.indexOf(id);
      const j = patch.move === "up" ? i - 1 : i + 1;
      if (j >= 0 && j < ids.length) [ids[i], ids[j]] = [ids[j], ids[i]];
      for (const [k, sid] of ids.entries()) await tx.category.update({ where: { id: sid }, data: { sortOrder: k } });
    });
  }
  revalidateCatalog();
}

export async function deleteCategory(id: string, moveToId?: string) {
  const current = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { children: true } } },
  });
  if (!current) throw notFound("Category not found.");
  const productCount = await prisma.product.count({ where: { categoryId: id } });
  const liveProducts = await prisma.product.count({ where: { categoryId: id, deletedAt: null } });

  if ((productCount > 0 || current._count.children > 0) && !moveToId) {
    throw conflict(
      `This category has ${liveProducts} product(s) and ${current._count.children} subcategory(ies). Move them to another category first.`,
      { products: [String(liveProducts)], children: [String(current._count.children)] },
    );
  }
  await prisma.$transaction(async (tx) => {
    if (moveToId) {
      if (moveToId === id) throw badRequest("Choose a different category.");
      const target = await tx.category.findUnique({ where: { id: moveToId } });
      if (!target) throw badRequest("Target category not found.");
      // Products (including soft-deleted ones, which still reference it) move to the target.
      await tx.product.updateMany({ where: { categoryId: id }, data: { categoryId: moveToId } });
      if (current._count.children > 0) {
        if (target.parentId) throw badRequest("Subcategories can only move under a top-level category.");
        if (target.id === id) throw badRequest("Invalid target.");
        await tx.category.updateMany({ where: { parentId: id }, data: { parentId: moveToId } });
      }
    }
    await tx.productCategory.deleteMany({ where: { categoryId: id } });
    await tx.category.delete({ where: { id } });
  });
  revalidateCatalog();
  return { name: current.name };
}

// ───────────── Brands ─────────────

export async function listBrands() {
  const brands = await prisma.brand.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: { where: { deletedAt: null } } } } },
  });
  return brands.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    description: b.description,
    logoUrl: b.logoUrl,
    isActive: b.isActive,
    productCount: b._count.products,
  }));
}
export type BrandRow = Awaited<ReturnType<typeof listBrands>>[number];

async function assertBrandFree(input: BrandInput, selfId?: string) {
  const clash = await prisma.brand.findFirst({
    where: { OR: [{ slug: input.slug }, { name: input.name }], id: selfId ? { not: selfId } : undefined },
  });
  if (clash) {
    throw conflict("A brand with this name or slug already exists.", clash.slug === input.slug ? { slug: ["Already in use"] } : { name: ["Already in use"] });
  }
}

export async function saveBrand(input: BrandInput, id?: string) {
  await assertBrandFree(input, id);
  const data = { name: input.name, slug: input.slug, description: input.description || null, logoUrl: input.logoUrl || null, isActive: input.isActive };
  const brand = id ? await prisma.brand.update({ where: { id }, data }) : await prisma.brand.create({ data });
  revalidateCatalog();
  return brand;
}

export async function deleteBrand(id: string) {
  const brand = await prisma.brand.findUnique({ where: { id } });
  if (!brand) throw notFound("Brand not found.");
  // Products keep existing; their brand is cleared (FK is ON DELETE SET NULL).
  await prisma.brand.delete({ where: { id } });
  revalidateCatalog();
  return brand;
}

// ───────────── Specification attributes ─────────────

export async function listAttributes() {
  const attrs = await prisma.productAttribute.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { values: true } } },
  });
  return attrs.map((a) => ({ id: a.id, name: a.name, slug: a.slug, sortOrder: a.sortOrder, valueCount: a._count.values }));
}
export type AttributeRow = Awaited<ReturnType<typeof listAttributes>>[number];

export async function saveAttribute(input: AttributeInput, id?: string) {
  const clash = await prisma.productAttribute.findFirst({
    where: { OR: [{ slug: input.slug }, { name: input.name }], id: id ? { not: id } : undefined },
  });
  if (clash) throw conflict("An attribute with this name or slug already exists.", { name: ["Already in use"] });
  const data = { name: input.name, slug: input.slug, sortOrder: input.sortOrder };
  const attr = id ? await prisma.productAttribute.update({ where: { id }, data }) : await prisma.productAttribute.create({ data });
  revalidateCatalog();
  return attr;
}

export async function deleteAttribute(id: string) {
  const attr = await prisma.productAttribute.findUnique({ where: { id }, include: { _count: { select: { values: true } } } });
  if (!attr) throw notFound("Attribute not found.");
  // Values cascade; the UI warns how many products lose this specification.
  await prisma.productAttribute.delete({ where: { id } });
  revalidateCatalog();
  return { name: attr.name, removedValues: attr._count.values };
}
