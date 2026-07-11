const CANONICAL_PRODUCTION_ORIGIN = "https://hazi.ng";
const LEGACY_PRODUCTION_HOSTS = new Set(["hazi-ng.vercel.app"]);

function normalizeOrigin(origin: string) {
  try {
    const url = new URL(origin);

    if (LEGACY_PRODUCTION_HOSTS.has(url.host.toLowerCase())) {
      return CANONICAL_PRODUCTION_ORIGIN;
    }

    return url.origin;
  } catch {
    return CANONICAL_PRODUCTION_ORIGIN;
  }
}

export function getCanonicalProductionOrigin() {
  return normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL || CANONICAL_PRODUCTION_ORIGIN);
}

export function getRequestOrigin(fallbackOrigin: string) {
  if (process.env.NODE_ENV === "production") {
    return getCanonicalProductionOrigin();
  }

  return fallbackOrigin;
}

