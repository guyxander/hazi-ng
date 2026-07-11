"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const VISITOR_KEY_STORAGE = "hazi_visitor_key";

function getVisitorKey() {
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY_STORAGE);

    if (existing) {
      return existing;
    }

    const next = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_KEY_STORAGE, next);
    return next;
  } catch {
    return null;
  }
}

function getDeviceType() {
  const width = window.innerWidth;

  if (width < 768) {
    return "mobile";
  }

  if (width < 1024) {
    return "tablet";
  }

  return "desktop";
}

export function SiteVisitTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/api")) {
      return;
    }

    const payload = {
      path: `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`,
      referrer: document.referrer || null,
      visitorKey: getVisitorKey(),
      deviceType: getDeviceType(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };
    const body = JSON.stringify(payload);

    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/analytics/visit", blob);
      return;
    }

    void fetch("/api/analytics/visit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true
    });
  }, [pathname, searchParams]);

  return null;
}
