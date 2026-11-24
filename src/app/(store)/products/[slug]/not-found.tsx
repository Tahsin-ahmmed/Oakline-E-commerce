import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

export default function ProductNotFound() {
  return (
    <div className="container-page py-20">
      <EmptyState
        icon={PackageSearch}
        title="This product isn't available"
        description="It may have sold out for good or moved. Browse the collection for something similar."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href="/products">Shop all products</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/search">Search</Link>
            </Button>
          </div>
        }
        className="mx-auto max-w-xl"
      />
    </div>
  );
}
