import { TECHNICAL_FALLBACK_TZ } from "@/lib/timezone/timezone-constants";

export function formatNumber(n: number) {
  return new Intl.NumberFormat("es-AR").format(n);
}

export function formatMoney(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatWithTimezone(
  date: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions,
  tz = TECHNICAL_FALLBACK_TZ,
  emptyValue = "-",
) {
  if (!date) return emptyValue;

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return emptyValue;

  return new Intl.DateTimeFormat("es-AR", {
    ...options,
    timeZone: tz,
  }).format(parsed);
}

export function formatDateWithOptions(
  date: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions,
  tz = TECHNICAL_FALLBACK_TZ,
  emptyValue = "-",
) {
  return formatWithTimezone(date, options, tz, emptyValue);
}

export function formatDate(
  date: string | Date | null | undefined,
  tz = TECHNICAL_FALLBACK_TZ,
) {
  return formatDateWithOptions(
    date,
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    },
    tz,
  );
}

export function formatDateTime(
  date: string | Date | null | undefined,
  tz = TECHNICAL_FALLBACK_TZ,
) {
  return formatDateWithOptions(
    date,
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    },
    tz,
  );
}
