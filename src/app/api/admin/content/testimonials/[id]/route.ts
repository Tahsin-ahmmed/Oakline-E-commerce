import { route } from "@/lib/api";
import { testimonialSchema } from "@/lib/validations/admin/content";
import { deleteTestimonial, updateTestimonial } from "@/services/admin/content";
import { logActivity } from "@/services/audit";

const opts = { auth: "staff", permission: "content.manage" } as const;

export const PUT = route<{ id: string }>(opts, async ({ params, json, user, ip }) => {
  const t = await updateTestimonial(params.id, await json(testimonialSchema));
  await logActivity({ user, ip, action: "testimonial.update", entityType: "Testimonial", entityId: t.id, summary: `Updated testimonial from ${t.name}` });
  return t;
});

export const DELETE = route<{ id: string }>(opts, async ({ params, user, ip }) => {
  const t = await deleteTestimonial(params.id);
  await logActivity({ user, ip, action: "testimonial.delete", entityType: "Testimonial", entityId: t.id, summary: `Deleted testimonial from ${t.name}` });
  return { deleted: true };
});
