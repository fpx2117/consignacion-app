import {
  parseDateInputAR,
  startOfDayAR,
  startOfMonthAR,
  startOfWeekAR,
} from "@/lib/date-format/utils-date";
import type { DashboardDateRange, DashboardPeriod } from "@/lib/types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;
const DASHBOARD_PERIODS: DashboardPeriod[] = [
  "today",
  "week",
  "month",
  "all",
  "custom",
];

export class DashboardDateRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DashboardDateRangeError";
  }
}

function parseCalendarDate(value: string, field: string): Date {
  if (!DATE_PATTERN.test(value)) {
    throw new DashboardDateRangeError(
      `${field} debe tener formato YYYY-MM-DD.`,
    );
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new DashboardDateRangeError(`${field} no es una fecha valida.`);
  }

  return date;
}

function addCalendarDay(value: string): string {
  const date = parseCalendarDate(value, "La fecha final");
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function validateDashboardDateRange(
  range: DashboardDateRange | null | undefined,
): DashboardDateRange {
  if (!range?.from || !range?.to) {
    throw new DashboardDateRangeError(
      "Debes indicar las fechas Desde y Hasta.",
    );
  }

  const from = parseCalendarDate(range.from, "Desde");
  const to = parseCalendarDate(range.to, "Hasta");
  if (from > to) {
    throw new DashboardDateRangeError(
      "La fecha Desde no puede ser posterior a Hasta.",
    );
  }

  const days = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
  if (days > MAX_RANGE_DAYS) {
    throw new DashboardDateRangeError(
      `El rango personalizado no puede superar ${MAX_RANGE_DAYS} dias.`,
    );
  }

  return { from: range.from, to: range.to };
}

export function parseDashboardDateQuery(searchParams: URLSearchParams): {
  period: DashboardPeriod;
  range?: DashboardDateRange;
} {
  const rawPeriod = searchParams.get("period") ?? "month";
  if (!DASHBOARD_PERIODS.includes(rawPeriod as DashboardPeriod)) {
    throw new DashboardDateRangeError("El periodo solicitado no es valido.");
  }

  const period = rawPeriod as DashboardPeriod;
  if (period !== "custom") return { period };

  return {
    period,
    range: validateDashboardDateRange({
      from: searchParams.get("from") ?? "",
      to: searchParams.get("to") ?? "",
    }),
  };
}

export function resolveDashboardDateWhere(
  period: DashboardPeriod,
  now: Date,
  tz: string,
  range?: DashboardDateRange | null,
): { gte: Date; lt: Date } | undefined {
  if (period === "all") return undefined;

  if (period === "custom") {
    const validRange = validateDashboardDateRange(range);
    return {
      gte: parseDateInputAR(validRange.from, tz),
      lt: parseDateInputAR(addCalendarDay(validRange.to), tz),
    };
  }

  if (period === "today") {
    const start = startOfDayAR(now, tz);
    return { gte: start, lt: new Date(start.getTime() + 86_400_000) };
  }

  if (period === "week") {
    const start = startOfWeekAR(now, tz);
    return { gte: start, lt: new Date(start.getTime() + 7 * 86_400_000) };
  }

  const start = startOfMonthAR(now, tz);
  const nextMonthReference = new Date(now);
  nextMonthReference.setMonth(nextMonthReference.getMonth() + 1);
  return { gte: start, lt: startOfMonthAR(nextMonthReference, tz) };
}

export function dashboardPeriodLabel(
  period: DashboardPeriod,
  range?: DashboardDateRange | null,
): string {
  if (period !== "custom") {
    return {
      today: "Hoy",
      week: "Esta semana",
      month: "Este mes",
      all: "Historico",
    }[period];
  }

  const validRange = validateDashboardDateRange(range);
  const format = (value: string) => {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  };
  return `${format(validRange.from)} al ${format(validRange.to)}`;
}
