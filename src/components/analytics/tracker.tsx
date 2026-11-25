"use client";

import { Suspense, useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";

type Fbq = ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[] };
declare global {
  interface Window {
    fbq?: Fbq;
  }
}

/** Send a standard Meta Pixel event if the pixel is installed. eventId lets Meta de-duplicate events. */
export function pixelTrack(event: string, params?: Record<string, unknown>, eventId?: string) {
  if (typeof window === "undefined" || !window.fbq) return;
  if (eventId) window.fbq("track", event, params ?? {}, { eventID: eventId });
  else window.fbq("track", event, params ?? {});
}

function Beacon({ pixel }: { pixel: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const last = useRef<string | null>(null);
  const first = useRef(true);

  useEffect(() => {
    // Automated browsers (test runners, scrapers) identify themselves via navigator.webdriver — don't count them.
    if (navigator.webdriver) return;
    const search = searchParams.toString();
    const key = `${pathname}?${search}`;
    if (last.current === key) return; // guards double effects in development
    last.current = key;
    // The external referrer only applies to the first page of the visit; later navigations are internal.
    const referrer = first.current ? document.referrer : window.location.origin + "/";
    first.current = false;
    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname, search: search ? `?${search}` : "", referrer }),
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => undefined);
    if (pixel) pixelTrack("PageView");
  }, [pathname, searchParams, pixel]);

  return null;
}

/** First-party visit tracking + optional Meta Pixel. Rendered once in the storefront layout. */
export function AnalyticsTracker({ enabled, metaPixelId }: { enabled: boolean; metaPixelId?: string }) {
  const pixel = Boolean(metaPixelId && /^\d{10,20}$/.test(metaPixelId));
  return (
    <>
      {pixel && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaPixelId}');`}
        </Script>
      )}
      {(enabled || pixel) && (
        <Suspense fallback={null}>{enabled ? <Beacon pixel={pixel} /> : <PixelOnly />}</Suspense>
      )}
    </>
  );
}

function PixelOnly() {
  const pathname = usePathname();
  useEffect(() => {
    pixelTrack("PageView");
  }, [pathname]);
  return null;
}

/** Fire a one-off pixel event when a page renders (ViewContent, InitiateCheckout, Purchase). */
export function PixelEvent({
  event,
  params,
  eventId,
  onceKey,
}: {
  event: string;
  params?: Record<string, unknown>;
  eventId?: string;
  /** When set, the event fires at most once per browser tab for this key (e.g. a purchase on refresh). */
  onceKey?: string;
}) {
  const payload = JSON.stringify(params ?? {});
  useEffect(() => {
    if (onceKey) {
      try {
        const k = `ezy_px_${onceKey}`;
        if (sessionStorage.getItem(k)) return;
        sessionStorage.setItem(k, "1");
      } catch {
        /* storage unavailable — fire anyway */
      }
    }
    // The pixel script loads after hydration; wait briefly for it.
    let tries = 0;
    const fire = () => {
      if (window.fbq) pixelTrack(event, JSON.parse(payload), eventId);
      else if (tries++ < 20) setTimeout(fire, 250);
    };
    fire();
  }, [event, payload, eventId, onceKey]);
  return null;
}
