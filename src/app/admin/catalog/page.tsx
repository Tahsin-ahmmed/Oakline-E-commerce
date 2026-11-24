import { requireStaff } from "@/lib/auth/guards";
import { listAttributes, listBrands } from "@/services/admin/categories";
import { PageHeader } from "@/components/admin/page-header";
import { CatalogManager } from "@/components/admin/catalog/catalog-manager";

export const metadata = { title: "Brands & attributes" };

export default async function CatalogPage() {
  await requireStaff("catalog.manage", "/admin/catalog");
  const [brands, attributes] = await Promise.all([listBrands(), listAttributes()]);
  return (
    <>
      <PageHeader title="Brands & attributes" description="Brands appear in filters; specification attributes describe products." />
      <CatalogManager brands={brands} attributes={attributes} />
    </>
  );
}
