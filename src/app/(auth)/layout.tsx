import Link from "next/link";
import { getSettings } from "@/services/settings";
import { Logo } from "@/components/layout/logo";
import { SmartImage } from "@/components/shared/smart-image";

const COVER = "https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=1600&q=80";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { general } = await getSettings();
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-muted lg:block">
        <SmartImage src={COVER} alt="" fill priority sizes="50vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-white">
          <p className="text-[0.7rem] font-semibold tracking-[0.22em] uppercase text-white/75">{general.siteName}</p>
          <p className="mt-3 max-w-md font-heading text-4xl leading-tight">{general.tagline}</p>
        </div>
      </div>
      <div className="flex flex-col">
        <header className="flex items-center justify-between px-6 py-6 sm:px-10">
          <Logo siteName={general.siteName} logoUrl={general.logoUrl || undefined} />
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            Back to shop
          </Link>
        </header>
        <main className="flex flex-1 items-center justify-center px-6 pb-16 sm:px-10">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}
