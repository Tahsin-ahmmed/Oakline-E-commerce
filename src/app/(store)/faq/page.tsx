import Link from "next/link";
import type { Metadata } from "next";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { JsonLd, PageIntro } from "@/components/content/page-intro";
import { getSettings } from "@/services/settings";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description: "Answers about ordering, delivery across Bangladesh, Cash on Delivery, card payments, returns and your account.",
  alternates: { canonical: "/faq" },
};

export default async function FaqPage() {
  const { commerce, general } = await getSettings();
  const free = commerce.freeShippingThreshold > 0 ? formatMoney(commerce.freeShippingThreshold, general.currency) : null;
  const days = commerce.returnWindowDays;

  const groups: { title: string; items: { q: string; a: string }[] }[] = [
    {
      title: "Orders",
      items: [
        { q: "How do I place an order?", a: "Add items to your bag, choose Checkout, enter your delivery details and pick a payment method. You don't need an account — but creating one lets you track orders and save addresses." },
        { q: "Can I change or cancel my order?", a: "You can cancel from your account while the order is Pending or Confirmed. Once we start preparing it, contact us as soon as possible and we'll do our best to help." },
        { q: "Will I get a confirmation?", a: "Yes. We email a confirmation with your order number straight away, and again whenever the status changes — confirmed, shipped, out for delivery and delivered." },
        { q: "Do you offer gift wrapping?", a: "All gift sets arrive wrapped. For other items, add a note at checkout and we'll wrap them in recycled kraft paper and twine at no extra cost." },
      ],
    },
    {
      title: "Shipping & delivery",
      items: [
        { q: "Where do you deliver?", a: "We deliver to all 64 districts of Bangladesh through trusted courier partners." },
        { q: "How long does delivery take?", a: "Inside Dhaka city usually 1–2 business days (same-day express available for orders before 12pm). Dhaka suburbs take 2–3 days and the rest of the country 3–5 business days." },
        {
          q: "How much is delivery?",
          a: `Fees depend on your area and are shown at checkout before you pay.${free ? ` Orders over ${free} ship free.` : ""} See our shipping policy for the full table.`,
        },
        { q: "How can I track my parcel?", a: "Use the Track Order page with your order number and email, or open the order in your account. Once shipped, you'll also see the courier and tracking number." },
      ],
    },
    {
      title: "Payments",
      items: [
        { q: "Which payment methods do you accept?", a: "Cash on Delivery nationwide, plus secure card payments (Visa, Mastercard, Amex) via Stripe where enabled. We're working on bKash, Nagad and SSLCommerz." },
        { q: "How does Cash on Delivery work?", a: "Simply choose Cash on Delivery at checkout and pay the courier in cash when your parcel arrives. Please keep the exact amount ready where possible." },
        { q: "Is paying by card safe?", a: "Yes. Card payments are processed by Stripe on a secure, PCI-compliant page. We never see or store your card details." },
        { q: "Are prices inclusive of VAT?", a: "Yes, all prices shown include applicable taxes. Delivery fees are shown separately at checkout." },
      ],
    },
    {
      title: "Returns & refunds",
      items: [
        { q: "What is your return policy?", a: `You can return unused items in their original packaging within ${days} days of delivery. Request a return from your order page and we'll arrange the pickup.` },
        { q: "What if my item arrives damaged?", a: "We're so sorry! Contact us within 48 hours with a photo and we'll send a replacement or issue a full refund — no return shipping cost to you." },
        { q: "How long do refunds take?", a: "Once we receive and inspect the return, card refunds are issued within 5–7 business days. Cash on Delivery orders are refunded via bKash or bank transfer." },
        { q: "Is anything non-returnable?", a: "For hygiene reasons opened personal care products can't be returned unless faulty. Gift cards and final-sale items are also non-returnable." },
      ],
    },
    {
      title: "Your account",
      items: [
        { q: "Do I need an account to shop?", a: "No — guest checkout is always available. An account lets you see order history, save addresses and keep a wishlist." },
        { q: "I forgot my password.", a: "Use “Forgot password” on the sign-in page and we'll email you a secure reset link that's valid for one hour." },
        { q: "How do I update my details?", a: "Sign in and open My account to change your name, phone number, password and saved addresses." },
        { q: "How do I unsubscribe from emails?", a: "Every newsletter has a one-click unsubscribe link at the bottom. Order and account emails will still be sent." },
      ],
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: groups.flatMap((g) =>
      g.items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
    ),
  };

  return (
    <div>
      <JsonLd data={jsonLd} />
      <PageIntro
        eyebrow="Help centre"
        title="Frequently asked questions"
        description="Quick answers about ordering, delivery, payment and returns."
        crumbs={[{ label: "FAQ" }]}
      />
      <div className="container-page grid gap-12 lg:grid-cols-[220px_1fr]">
        <nav aria-label="FAQ topics" className="hidden lg:block">
          <ul className="sticky top-36 space-y-2 text-sm">
            {groups.map((g) => (
              <li key={g.title}>
                <a href={`#${g.title.toLowerCase().replace(/[^a-z]+/g, "-")}`} className="text-muted-foreground hover:text-foreground">
                  {g.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="max-w-3xl space-y-12">
          {groups.map((g) => (
            <section key={g.title} id={g.title.toLowerCase().replace(/[^a-z]+/g, "-")} className="scroll-mt-36">
              <h2 className="text-2xl">{g.title}</h2>
              <Accordion type="multiple" className="mt-3">
                {g.items.map((item) => (
                  <AccordionItem key={item.q} value={item.q}>
                    <AccordionTrigger className="py-4 text-left text-[0.98rem] font-normal hover:no-underline">{item.q}</AccordionTrigger>
                    <AccordionContent className="pb-4 text-[0.95rem] leading-7 text-muted-foreground">{item.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          ))}
          <div className="rounded-xl border bg-card p-6 text-center">
            <p className="font-heading text-xl">Didn&apos;t find your answer?</p>
            <p className="mt-1 text-sm text-muted-foreground">Our team is happy to help, Saturday to Thursday.</p>
            <Button asChild className="mt-4">
              <Link href="/contact">Contact us</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
