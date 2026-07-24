/**
 * utils-date.ts — Utilidades de fecha con timezone configurable.
 *
 * TIMEZONE: Todas las funciones aceptan `tz` opcional (IANA string).
 * Default: "America/Argentina/Buenos_Aires" (TZ_AR).
 *
 * Los callers (rutas API, kpi-logic) leen la TZ de getConfiguredTz(sucursalId)
 * y la pasan aquí. Las funciones son puras y testeables sin acoplarse a Prisma.
 *
 * REGLA:
 *   - Para guardar en DB:      nowAR(tz)
 *   - Para mostrar al usuario: formatDateAR() / formatDateTimeAR() con tz forzado
 *   - Para rangos de día/mes:  startOfDayAR(d, tz) / startOfMonthAR(d, tz)
 */

import { TECHNICAL_FALLBACK_TZ } from "@/lib/timezone/timezone-constants";

export const TZ_AR = TECHNICAL_FALLBACK_TZ;

// ── Helpers internos ──────────────────────────────────────────────────────────

function getDatePartsInTz(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);

  return {
    year: Number(parts.find((p) => p.type === "year")!.value),
    month: Number(parts.find((p) => p.type === "month")!.value) - 1,
    day: Number(parts.find((p) => p.type === "day")!.value),
    weekday: parts.find((p) => p.type === "weekday")!.value, // "Mon", "Tue"...
  };
}

/** Offset en minutos de una TZ respecto a UTC (positivo = detrás de UTC) */
function getTzOffsetMinutes(tz: string, date: Date): number {
  const utcStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
  const tzStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);

  const parseStr = (s: string): Date => {
    // en-CA format: "2026-03-15, 03:20:00"
    const clean = s.replace(",", "");
    return new Date(clean + "Z");
  };

  const utcMs = parseStr(utcStr).getTime();
  const tzMs = parseStr(tzStr).getTime();
  return Math.round((utcMs - tzMs) / 60_000);
}

// ── 1. "Ahora" en la timezone configurada ─────────────────────────────────────

/**
 * Devuelve la hora actual representada como Date en la timezone indicada.
 * Si el proceso ya corre en esa TZ, devuelve new Date() sin ajuste.
 */
export function nowAR(tz = TZ_AR): Date {
  const now = new Date();
  const processOffsetMin = now.getTimezoneOffset(); // +180 si servidor en UTC
  const tzOffsetMin = getTzOffsetMinutes(tz, now); // offset de la TZ objetivo

  if (processOffsetMin === tzOffsetMin) return now;

  // Ajustar: el valor "wall clock" en la TZ objetivo
  const diffMs = (tzOffsetMin - processOffsetMin) * 60_000;
  return new Date(now.getTime() - diffMs);
}

// ── 2. Inicio/fin de rangos ───────────────────────────────────────────────────

/** Medianoche del día actual en la TZ dada, expresada como timestamp UTC */
export function startOfDayAR(date?: Date, tz = TZ_AR): Date {
  const d = date ?? nowAR(tz);
  const { year, month, day } = getDatePartsInTz(d, tz);
  // Medianoche TZ → convertir a UTC: restar el offset de la TZ
  const tzOffsetMin = getTzOffsetMinutes(tz, d);
  return new Date(Date.UTC(year, month, day) + tzOffsetMin * 60_000);
}

/** 23:59:59.999 del día actual en la TZ dada */
export function endOfDayAR(date?: Date, tz = TZ_AR): Date {
  const start = startOfDayAR(date, tz);
  return new Date(start.getTime() + 86_400_000 - 1);
}

/** Lunes 00:00:00 de la semana que contiene `date`, en la TZ dada */
export function startOfWeekAR(date?: Date, tz = TZ_AR): Date {
  const d = date ?? nowAR(tz);
  const { year, month, day, weekday } = getDatePartsInTz(d, tz);
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dow = weekdayMap[weekday] ?? 0;
  const daysBack = dow === 0 ? 6 : dow - 1;
  const tzOffsetMin = getTzOffsetMinutes(tz, d);
  return new Date(Date.UTC(year, month, day - daysBack) + tzOffsetMin * 60_000);
}

/** Primer día del mes actual en la TZ dada */
export function startOfMonthAR(date?: Date, tz = TZ_AR): Date {
  const d = date ?? nowAR(tz);
  const { year, month } = getDatePartsInTz(d, tz);
  const tzOffsetMin = getTzOffsetMinutes(tz, d);
  return new Date(Date.UTC(year, month, 1) + tzOffsetMin * 60_000);
}

/**
 * Rango completo de un mes en la TZ dada (para filtros de historial).
 * @param year  Año
 * @param month Mes 0-indexed
 */
export function monthRangeAR(
  year: number,
  month: number,
  tz = TZ_AR,
): { start: Date; end: Date } {
  const refDate = new Date(Date.UTC(year, month, 15)); // mitad del mes como referencia
  const tzOffsetMin = getTzOffsetMinutes(tz, refDate);
  const start = new Date(Date.UTC(year, month, 1) + tzOffsetMin * 60_000);
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  // Fin: último día del mes + 23:59:59.999 en TZ → en UTC
  const end = new Date(
    Date.UTC(year, month, lastDay + 1) + tzOffsetMin * 60_000 - 1,
  );
  return { start, end };
}

// ── 3. Getters de partes de fecha en TZ ──────────────────────────────────────

/** Día de semana en TZ (0=dom, 1=lun, …, 6=sab) */
export function getDayOfWeekAR(date?: Date, tz = TZ_AR): number {
  const d = date ?? nowAR(tz);
  const { weekday } = getDatePartsInTz(d, tz);
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return weekdayMap[weekday] ?? 0;
}

/** Hora y minuto actuales en TZ como "HH:MM" */
export function getTimeStringAR(date?: Date, tz = TZ_AR): string {
  const d = date ?? nowAR(tz);
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

// ── 4. Formateo visual ────────────────────────────────────────────────────────

/** Formatea una fecha para mostrar al usuario (solo fecha) */
export function formatDateSafe(
  dateStr: string | Date | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
  tz = TZ_AR,
): string {
  if (!dateStr) return "";
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    timeZone: tz,
    ...opts,
  });
}

/** Formatea fecha + hora para timestamps, forzando la TZ configurada */
export function formatDateTimeAR(
  dateStr: string | Date | null | undefined,
  includeTime = true,
  tz = TZ_AR,
): string {
  if (!dateStr) return "—";
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return "—";

  const base: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: tz,
  };

  if (includeTime) {
    base.hour = "2-digit";
    base.minute = "2-digit";
    base.hour12 = false;
  }

  return d.toLocaleString("es-AR", base);
}

export function formatDateInputAR(
  dateStr: string | Date | null | undefined,
  tz = TZ_AR,
): string {
  if (!dateStr) return "";
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : "";
}

export function formatTimeInputAR(
  dateStr: string | Date | null | undefined,
  tz = TZ_AR,
): string {
  if (!dateStr) return "";
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function parseDateInputAR(value: string, tz = TZ_AR): Date {
  const [yearStr, monthStr, dayStr] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!year || !month || !day) {
    throw new Error(`Fecha invalida: ${value}`);
  }

  const ref = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return startOfDayAR(ref, tz);
}

export function parseDateTimeInputAR(
  dateValue: string,
  timeValue = "00:00",
  tz = TZ_AR,
): Date {
  const base = parseDateInputAR(dateValue, tz);
  const [hoursStr, minutesStr] = timeValue.split(":");
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error(`Hora invalida: ${timeValue}`);
  }

  return new Date(base.getTime() + (hours * 60 + minutes) * 60_000);
}

// ── 5. Comparaciones ──────────────────────────────────────────────────────────

/** Días entre una fecha y hoy en TZ (positivo = futuro) */
export function diffDaysUTC(dateStr: string | Date, tz = TZ_AR): number {
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const todayStart = startOfDayAR(undefined, tz);
  const targetStart = startOfDayAR(d, tz);
  return Math.ceil((targetStart.getTime() - todayStart.getTime()) / 86_400_000);
}

/** ¿La fecha ya pasó? */
export function isExpired(dateStr: string | Date, tz = TZ_AR): boolean {
  return diffDaysUTC(dateStr, tz) < 0;
}

/** ¿Vence dentro de `days` días? (default 7) */
export function isExpiringSoon(
  dateStr: string | Date,
  days = 7,
  tz = TZ_AR,
): boolean {
  const diff = diffDaysUTC(dateStr, tz);
  return diff >= 0 && diff <= days;
}
