"use client";

import { useEffect } from "react";

/** Last-resort error boundary (replaces the root layout), so it uses inline styles only. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f4ef",
          color: "#2a2622",
          fontFamily: "Georgia, serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div>
          <p style={{ letterSpacing: ".2em", fontSize: 12, textTransform: "uppercase", fontFamily: "Helvetica, Arial, sans-serif" }}>Ezyza</p>
          <h1 style={{ fontWeight: 400, fontSize: 36, margin: "16px 0" }}>Something went wrong</h1>
          <p style={{ fontFamily: "Helvetica, Arial, sans-serif", color: "#6e675e", maxWidth: 420 }}>
            An unexpected error occurred. Please try again in a moment.
          </p>
          {error.digest && <p style={{ fontFamily: "monospace", fontSize: 12, color: "#8a8178" }}>Ref: {error.digest}</p>}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              background: "#2f2a25",
              color: "#fff",
              border: 0,
              borderRadius: 6,
              padding: "12px 24px",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
