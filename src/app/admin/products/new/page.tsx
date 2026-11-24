import { requireStaff } from "@/lib/auth/guards";
import { productFormOptions } from "@/services/admin/products";
import { ProductForm } from "@/components/admin/catalog/product-form";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  await requireStaff("products.manage", "/admin/products/new");
  const options = await productFormOptions();
  return <ProductForm initial={null} options={options} />;
}
