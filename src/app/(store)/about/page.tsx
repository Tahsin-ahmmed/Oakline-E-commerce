import Link from "next/link";
import type { Metadata } from "next";
import { Hammer, Leaf, Recycle, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SmartImage } from "@/components/shared/smart-image";
import { Crumbs } from "@/components/content/page-intro";
import { getSettings } from "@/services/settings";

const u = (id: string, w = 1600) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;
const IMAGES = {
  hero: u("1616046229478-9901c5536a45", 2000),
  studio: u("1513694203232-719a280e022f"),
  ceramics: u("1610701596007-11502861dcfa", 1000),
  leather: u("1622560480605-d83c853bc5c3", 1000),
  textiles: u("1579656381226-5fc0f0100c3b", 1000),
};

export async function generateMetadata(): Promise<Metadata> {
  const { general } = await getSettings();
  return {
    title: "About us",
    description: `${general.siteName} makes considered goods for everyday living — designed in Dhaka, made with makers who care.`,
    alternates: { canonical: "/about" },
    openGraph: { images: [{ url: IMAGES.hero }] },
  };
}

const VALUES = [
  { icon: Leaf, title: "Natural materials", body: "Stoneware, linen, full-grain leather, solid wood. Materials that feel good in the hand and age with grace." },
  { icon: Hammer, title: "Made by hand", body: "We partner with small workshops — potters in Rajshahi, weavers in Tangail, leatherworkers in Hazaribagh — and pay fairly." },
  { icon: Recycle, title: "Built to last", body: "Fewer, better things. We design for decades of use, offer care guides, and repair what we can." },
  { icon: Truck, title: "Thoughtful delivery", body: "Plastic-free packaging, Cash on Delivery nationwide and a 14-day return window, because trust matters." },
];

export default async function AboutPage() {
  const { general } = await getSettings();
  return (
    <div>
      <section className="relative isolate overflow-hidden">
        <SmartImage src={IMAGES.hero} alt="A calm, sunlit living room styled with natural materials" fill priority sizes="100vw" className="-z-10 object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/55 via-black/20 to-black/10" />
        <div className="container-page flex min-h-[60vh] flex-col justify-between pt-8 pb-14 text-white sm:min-h-[70vh]">
          <div className="[&_a:hover]:text-white [&_ol]:text-white/75 [&_span]:text-white">
            <Crumbs items={[{ label: "About us" }]} />
          </div>
          <div>
            <p className="eyebrow !text-white/80">Our story</p>
            <h1 className="mt-3 max-w-3xl text-4xl leading-[1.08] sm:text-6xl">Objects for a slower, more considered life.</h1>
          </div>
        </div>
      </section>

      <section className="container-page grid gap-10 py-20 lg:grid-cols-12">
        <p className="font-heading text-2xl leading-snug sm:text-3xl lg:col-span-7">
          {general.siteName} began in a small studio in Gulshan with a simple belief: the things we live with every day should be beautiful,
          useful and made to last.
        </p>
        <div className="space-y-4 text-[0.98rem] leading-7 text-muted-foreground lg:col-span-5">
          <p>
            We were tired of homeware designed to be replaced. So we started visiting workshops across Bangladesh — kilns, looms and tanneries —
            and found makers whose skill deserved a wider audience.
          </p>
          <p>
            Today we design every collection in-house and produce it in small batches with those same partners. Each piece is checked by hand in
            our Dhaka warehouse before it is wrapped and sent to you.
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
          <SmartImage src={IMAGES.studio} alt="Our studio, with a sideboard and dried flowers" fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
        </div>
        <div>
          <p className="eyebrow">The makers</p>
          <h2 className="mt-3 text-3xl sm:text-4xl">Small workshops, long relationships</h2>
          <p className="mt-5 leading-7 text-muted-foreground">
            We work with fewer than twenty partner workshops and visit each of them several times a year. We agree prices before production,
            pay deposits up front and never squeeze margins at the end of a season. In return we get extraordinary care — and you get pieces with a
            story behind them.
          </p>
          <dl className="mt-10 grid grid-cols-3 gap-6 border-t pt-8">
            {[
              ["18", "Partner workshops"],
              ["40k+", "Orders delivered"],
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
          { src: IMAGES.ceramics, label: "Stoneware, Rajshahi", href: "/categories/kitchen-dining" },
          { src: IMAGES.textiles, label: "Linen & cotton, Tangail", href: "/categories/home-decor" },
          { src: IMAGES.leather, label: "Leather, Hazaribagh", href: "/categories/bags-wallets" },
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
