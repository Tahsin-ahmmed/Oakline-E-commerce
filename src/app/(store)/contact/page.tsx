import Link from "next/link";
import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { PageIntro } from "@/components/content/page-intro";
import { ContactForm } from "@/components/content/contact-form";
import { getSettings } from "@/services/settings";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Questions about an order, a product or wholesale? Our team in Dhaka is here to help.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const [{ general }, user] = await Promise.all([getSettings(), getCurrentUser()]);
  const details = [
    general.contactEmail && { icon: Mail, label: "Email", value: general.contactEmail, href: `mailto:${general.contactEmail}` },
    general.phone && { icon: Phone, label: "Phone", value: general.phone, href: `tel:${general.phone.replace(/\s/g, "")}` },
    general.address && { icon: MapPin, label: "Studio & warehouse", value: general.address },
    { icon: Clock, label: "Hours", value: "Saturday – Thursday, 10am – 7pm" },
  ].filter(Boolean) as { icon: typeof Mail; label: string; value: string; href?: string }[];

  return (
    <div>
      <PageIntro
        eyebrow="Get in touch"
        title="We'd love to hear from you"
        description="Whether it's a question about an order, help choosing a gift, or a wholesale enquiry — send us a note and a real person will reply."
        crumbs={[{ label: "Contact" }]}
      />
      <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-8">
          <ul className="space-y-6">
            {details.map((d) => (
              <li key={d.label} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <d.icon className="size-4" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">{d.label}</p>
                  {d.href ? (
                    <a href={d.href} className="font-medium underline-offset-4 hover:underline">
                      {d.value}
                    </a>
                  ) : (
                    <p className="font-medium">{d.value}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="rounded-xl border bg-secondary/40 p-6 text-sm leading-6">
            <p className="font-medium">Looking for a quick answer?</p>
            <p className="mt-1 text-muted-foreground">
              Most questions about delivery times, Cash on Delivery and returns are answered in our{" "}
              <Link href="/faq" className="underline underline-offset-4">
                FAQ
              </Link>
              . You can also{" "}
              <Link href="/track-order" className="underline underline-offset-4">
                track your order
              </Link>{" "}
              anytime.
            </p>
          </div>
        </div>
        <ContactForm defaultName={user?.name} defaultEmail={user?.email} />
      </div>
    </div>
  );
}
