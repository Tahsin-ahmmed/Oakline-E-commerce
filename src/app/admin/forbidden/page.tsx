import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata = { title: "Access denied" };

export default function ForbiddenPage() {
  return (
    <EmptyState
      icon={ShieldAlert}
      title="You don't have access to this page"
      description="Your role doesn't include permission for this section. Ask a Super Admin if you need access."
      action={
        <Button asChild variant="outline">
          <Link href="/admin">Back to dashboard</Link>
        </Button>
      }
      className="mx-auto mt-16 max-w-lg"
    />
  );
}
