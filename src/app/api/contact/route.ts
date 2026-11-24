import { route } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { stripHtml } from "@/lib/sanitize";
import { contactSchema } from "@/lib/validations/content";
import { appUrl, env } from "@/lib/env";
import { sendMail } from "@/lib/email/mailer";
import { adminAlertTemplate } from "@/lib/email/templates";
import { notifyAdmins } from "@/services/notifications";
import { getSettings } from "@/services/settings";

export const POST = route({ auth: "none", rateLimit: RATE_LIMITS.contact }, async ({ json }) => {
  const input = await json(contactSchema);
  const msg = await prisma.contactMessage.create({
    data: {
      name: stripHtml(input.name),
      email: input.email,
      phone: input.phone || null,
      subject: stripHtml(input.subject),
      message: stripHtml(input.message),
    },
  });
  await notifyAdmins({ type: "contact.new", title: `New message: ${msg.subject}`, body: msg.name, link: "/admin/messages" });
  const adminEmail = env().ADMIN_NOTIFICATION_EMAIL;
  if (adminEmail) {
    const { general } = await getSettings();
    await sendMail({
      to: adminEmail,
      ...adminAlertTemplate({
        siteName: general.siteName,
        title: `Contact form: ${msg.subject}`,
        lines: [`From ${msg.name} <${msg.email}>`, msg.message],
        url: appUrl("/admin/messages"),
      }),
    });
  }
  return { message: "Thanks for getting in touch — we'll reply within one business day." };
});
