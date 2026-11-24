import Link from "next/link";
import type { Metadata } from "next";
import { BadgeCheck, Gem, RefreshCcw, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SmartImage } from "@/components/shared/smart-image";
import { Crumbs } from "@/components/content/page-intro";
import { getSettings } from "@/services/settings";

const u = (id: string, w = 1600) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;
const IMAGES = {
  hero: u("1445205170230-053b83016050", 2000),
  studio: u("1441986300917-64674bd600d8"),
  men: u("1553143820-6bb68bc34679", 1000),
  women: u("1621184455862-c163dfb30e0f", 1000),
  leather: u("1622560480605-d83c853bc5c3", 1000),
};

export async function generateMetadata(): Promise<Metadata> {
  const { general } = await getSettings();
  return {
    title: "About us",
    description: `${general.siteName} designs sunglasses, footwear, bags, leather goods and everyday clothing for men and women — made in Bangladesh, delivered nationwide.`,
    alternates: { canonical: "/about" },
    openGraph: { images: [{ url: IMAGES.hero }] },
  };
}

const VALUES = [
  { icon: Gem, title: "Quality you can feel", body: "Full-grain leather, breathable cotton and UV400 lenses. We choose materials that look good and hold up to real life." },
  { icon: BadgeCheck, title: "Fair prices", body: "We design in-house and work directly with manufacturers, so you pay for the product — not for middlemen." },
  { icon: RefreshCcw, title: "Easy exchanges", body: "Wrong size? Changed your mind? Return or exchange unused items within 14 days of delivery." },
  { icon: Truck, title: "Nationwide delivery", body: "Fast delivery to all 64 districts with Cash on Delivery, so you only pay when your order arrives." },
];

export default async function AboutPage() {
  const { general } = await getSettings();
  return (
    <div>
      <section className="relative isolate overflow-hidden">
        <SmartImage src={IMAGES.hero} alt="Racks of Ezyza clothing in our Dhaka studio" fill priority sizes="100vw" className="-z-10 object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/55 via-black/20 to-black/10" />
        <div className="container-page flex min-h-[60vh] flex-col justify-between pt-8 pb-14 text-white sm:min-h-[70vh]">
          <div className="[&_a:hover]:text-white [&_ol]:text-white/75 [&_span]:text-white">
            <Crumbs items={[{ label: "About us" }]} />
          </div>
          <div>
            <p className="eyebrow !text-white/80">Our story</p>
            <h1 className="mt-3 max-w-3xl text-4xl leading-[1.08] sm:text-6xl">Style made easy, for him and for her.</h1>
          </div>
        </div>
      </section>

      <section className="container-page grid gap-10 py-20 lg:grid-cols-12">
        <p className="font-heading text-2xl leading-snug sm:text-3xl lg:col-span-7">
          {general.siteName} began in a small studio in Gulshan with a simple belief: looking good every day shouldn&apos;t be complicated —
          or expensive.
        </p>
        <div className="space-y-4 text-[0.98rem] leading-7 text-muted-foreground lg:col-span-5">
          <p>
            We wanted sunglasses, shoes, bags and shirts that look premium, suit our climate and don&apos;t fall apart after one season. When we
            couldn&apos;t find them at a fair price, we started making them.
          </p>
          <p>
            Today we design every collection in-house — from leather belts made in Hazaribagh to cotton shirts cut for Dhaka summers. Each piece is
            checked by hand in our warehouse before it is packed and sent to you.
          </p>
        </div>
      </section>

      <section className="bg-secondary/50 py-20">
        <div className="container-page">
          <p className="eyebrow">What we stand for</p>
          <h2 className="mt-3 text-3xl sm:text-4xl">Four promises we keep</h2>
          <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v) => (
              <li key={v.title}>
                <span className="flex size-11 items-center justify-center rounded-full bg-card shadow-[var(--shadow-soft)]">
                  <v.icon className="size-5 text-clay" />
                </span>
                <h3 className="mt-5 font-sans text-base font-semibold tracking-normal">{v.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{v.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-page grid items-center gap-12 py-20 lg:grid-cols-2">
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-muted">
          <SmartImage src={IMAGES.studio} alt="Inside the Ezyza store" fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
        </div>
        <div>
          <p className="eyebrow">How we work</p>
          <h2 className="mt-3 text-3xl sm:text-4xl">Designed in Dhaka, made with care</h2>
          <p className="mt-5 leading-7 text-muted-foreground">
            We work with a small group of trusted manufacturers and leather workshops, and we visit them regularly. Every new style is wear-tested
            by our team before it goes on sale, and we keep collections focused so each piece earns its place in your wardrobe.
          </p>
          <dl className="mt-10 grid grid-cols-3 gap-6 border-t pt-8">
            {[
              ["60+", "Styles in store"],
              ["14-day", "Easy returns"],
              ["64", "Districts served"],
            ].map(([n, l]) => (
              <div key={l}>
                <dt className="sr-only">{l}</dt>
                <dd className="font-heading text-3xl">{n}</dd>
                <dd className="mt-1 text-xs text-muted-foreground">{l}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="container-page grid gap-4 pb-8 sm:grid-cols-3">
        {[
          { src: IMAGES.men, label: "Shop men", href: "/categories/men" },
          { src: IMAGES.women, label: "Shop women", href: "/categories/women" },
          { src: IMAGES.leather, label: "Leather bags & wallets", href: "/products?type=bags" },
        ].map((item) => (
          <Link key={item.label} href={item.href} className="group relative aspect-[4/5] overflow-hidden rounded-xl bg-muted">
            <SmartImage src={item.src} alt="" fill sizes="(max-width:640px) 100vw, 33vw" className="object-cover transition duration-700 group-hover:scale-[1.03]" />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 p-5 text-sm font-medium text-white">{item.label} →</span>
          </Link>
        ))}
      </section>

      <section className="container-page py-16 text-center">
        <h2 className="text-3xl">Come and see for yourself</h2>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">Browse the collection, or drop us a line — we love hearing from you.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/products">Shop the collection</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/contact">Contact us</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
