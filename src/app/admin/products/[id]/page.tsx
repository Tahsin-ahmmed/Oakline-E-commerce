import { notFound } from "next/navigation";
import { can, requireStaff } from "@/lib/auth/guards";
import { getAdminProduct, productFormOptions } from "@/services/admin/products";
import { ProductForm } from "@/components/admin/catalog/product-form";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getAdminProduct(id);
  return { title: p ? p.input.name : "Product" };
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStaff("products.view", `/admin/products/${id}`);
  const [product, options] = await Promise.all([getAdminProduct(id), productFormOptions()]);
  if (!product) notFound();
  // Cost price is admin-only: hide it from read-only viewers.
  if (!can(user, "products.manage")) product.input.costPrice = null;
  return (
    <ProductForm
      key={product.meta.updatedAt}
      productId={product.id}
      initial={product.input}
      options={options}
      storeSlug={product.meta.status === "ACTIVE" ? product.meta.slug : undefined}
    />
  );
}
