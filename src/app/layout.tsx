import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryProvider } from "@/components/shared/query-provider";
import { getSettings } from "@/services/settings";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const display = Playfair_Display({ variable: "--font-display", subsets: ["latin"], display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const { general, seo } = await getSettings();
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    metadataBase: new URL(base),
    title: { default: seo.defaultTitle, template: `%s | ${general.siteName}` },
    description: seo.defaultDescription,
    applicationName: general.siteName,
    icons: general.faviconUrl ? { icon: general.faviconUrl } : undefined,
    openGraph: {
      type: "website",
      siteName: general.siteName,
      title: seo.defaultTitle,
      description: seo.defaultDescription,
      images: [{ url: seo.ogImageUrl || "/brand/ezyza-og.png" }],
    },
    twitter: { card: "summary_large_image" },
    alternates: { canonical: "/" },
  };
}

export const viewport: Viewport = {
  themeColor: "#0b0b0b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body className="min-h-dvh">
        <QueryProvider>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        </QueryProvider>
        <Toaster />
      </body>
    </html>
  );
}
