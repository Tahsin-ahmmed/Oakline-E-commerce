import { route } from "@/lib/api";
import { testimonialSchema } from "@/lib/validations/admin/content";
import { createTestimonial, listTestimonials } from "@/services/admin/content";
import { logActivity } from "@/services/audit";

const opts = { auth: "staff", permission: "content.manage" } as const;

export const GET = route(opts, async () => listTestimonials());

export const POST = route(opts, async ({ json, user, ip }) => {
  const t = await createTestimonial(await json(testimonialSchema));
  await logActivity({ user, ip, action: "testimonial.create", entityType: "Testimonial", entityId: t.id, summary: `Added testimonial from ${t.name}` });
  return t;
});
