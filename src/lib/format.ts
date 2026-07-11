export function formatNaira(value: number | null | undefined) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0
  }).format(value ?? 0);
}

export const HAZI_TIME_ZONE = "Africa/Lagos";

export function formatDate(value: string | number | Date | null | undefined) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeZone: HAZI_TIME_ZONE
  }).format(new Date(value));
}

export function formatDateTime(value: string | number | Date | null | undefined) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: HAZI_TIME_ZONE
  }).format(new Date(value));
}

export function formatCondition(condition: string | null | undefined) {
  return (condition || "good").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
