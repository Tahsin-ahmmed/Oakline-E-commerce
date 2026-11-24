import { requireStaff } from "@/lib/auth/guards";
import { listCategoryTree } from "@/services/admin/categories";
import { PageHeader } from "@/components/admin/page-header";
import { CategoryManager } from "@/components/admin/catalog/category-manager";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  await requireStaff("catalog.manage", "/admin/categories");
  const tree = await listCategoryTree();
  const subCount = tree.reduce((n, c) => n + c.children.length, 0);
  return (
    <>
      <PageHeader title="Categories" description={`${tree.length} top-level categories · ${subCount} subcategories`} />
      <CategoryManager tree={tree} />
    </>
  );
}
