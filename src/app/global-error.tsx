"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const payload = {
      level: "error",
      message: "global_error_boundary",
      error: error.message,
      digest: error.digest,
      stack: error.stack,
      path: window.location.pathname
    };

    console.error(JSON.stringify(payload));

    fetch("/api/monitoring/error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "global_error_boundary",
        message: error.message,
        digest: error.digest,
        path: window.location.pathname,
        stack: error.stack
      })
    }).catch(() => undefined);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="container grid min-h-screen place-items-center py-16">
          <section className="card max-w-xl p-8 text-center">
            <h1 className="section-title">This page could not load</h1>
            <p className="mt-3 text-[var(--muted)]">A server error occurred. Reload to try again.</p>
            <button className="button button-primary mt-6" type="button" onClick={reset}>
              Reload
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
