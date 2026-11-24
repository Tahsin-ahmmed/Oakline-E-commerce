import { AdminTableSkeleton } from "@/components/admin/catalog/table-skeleton";

export default function Loading() {
  return <AdminTableSkeleton rows={10} cards={5} />;
}
