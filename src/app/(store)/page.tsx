import type { Metadata } from "next";
import { getHomepage } from "@/services/homepage";
import { getSettings } from "@/services/settings";
import { HeroCarousel } from "@/components/home/hero-carousel";
import {
  CategoriesSection,
  CollectionsSection,
  InstagramSection,
  NewsletterSection,
  ProductsSection,
  PromoSection,
  StorySection,
  TestimonialsSection,
} from "@/components/home/sections";

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getSettings();
  return { title: { absolute: seo.defaultTitle }, description: seo.defaultDescription, alternates: { canonical: "/" } };
}

export default async function HomePage() {
  const [sections, settings] = await Promise.all([getHomepage(), getSettings()]);
  const firstProductsKey = sections.find((s) => s.type === "products")?.key;
  return (
    <>
      <h1 className="sr-only">{settings.general.siteName} — {settings.general.tagline}</h1>
      {sections.map((section) => {
        switch (section.type) {
          case "hero":
            return <HeroCarousel key={section.key} banners={section.banners} />;
          case "categories":
            return <CategoriesSection key={section.key} section={section} />;
          case "products":
            return <ProductsSection key={section.key} section={section} priority={section.key === firstProductsKey} />;
          case "promo":
            return <PromoSection key={section.key} section={section} />;
          case "collections":
            return <CollectionsSection key={section.key} section={section} />;
          case "story":
            return <StorySection key={section.key} section={section} />;
          case "testimonials":
            return <TestimonialsSection key={section.key} section={section} />;
          case "newsletter":
            return settings.newsletter.enabled ? (
              <NewsletterSection key={section.key} heading={settings.newsletter.heading} subheading={settings.newsletter.subheading} />
            ) : null;
          case "instagram":
            return <InstagramSection key={section.key} section={section} />;
          default:
            return null;
        }
      })}
    </>
  );
}
