import Link from "next/link";

export function MaintenanceScreen({ siteName, message }: { siteName: string; message: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow">{siteName}</p>
      <h1 className="mt-4 font-heading text-4xl sm:text-5xl">We&apos;ll be back soon</h1>
      <p className="mt-4 max-w-md text-muted-foreground">{message}</p>
      <Link href="/login" className="mt-10 text-xs text-muted-foreground underline underline-offset-4">
        Staff sign in
      </Link>
    </main>
  );
}
