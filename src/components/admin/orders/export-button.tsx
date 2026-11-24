"use client";

import { Download } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

/** Downloads a CSV for the endpoint, forwarding the current list filters. */
export function ExportButton({ endpoint, label = "Export CSV" }: { endpoint: string; label?: string }) {
  const params = useSearchParams();
  const qs = new URLSearchParams(params.toString());
  qs.delete("page");
  const href = `${endpoint}${qs.toString() ? `?${qs}` : ""}`;
  return (
    <Button variant="outline" asChild>
      <a href={href} download>
        <Download /> {label}
      </a>
    </Button>
  );
}
