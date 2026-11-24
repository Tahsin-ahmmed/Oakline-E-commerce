import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/page-header";
import { TestimonialsManager } from "@/components/admin/content/testimonials-manager";
import { listTestimonials } from "@/services/admin/content";

export const metadata: Metadata = { title: "Testimonials" };

export default async function TestimonialsPage() {
  await requireStaff("content.manage", "/admin/content/testimonials");
  const items = await listTestimonials();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Testimonials" description="Customer quotes displayed on the homepage, in display order." />
      <TestimonialsManager items={items} />
    </div>
  );
}
