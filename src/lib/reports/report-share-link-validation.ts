import type { DashboardDateRange, DashboardPeriod } from "@/lib/types";

export type ReportShareLinkType =
  "REPORTE_DASHBOARD" | "REPORTE_POS" | "REPORTE_CONSIGNACION";

type ReportShareLinkRecord = {
  type: string;
  targetId: number;
  expiresAt: Date;
  views: number;
  maxViews: number;
  rangeStart: Date | null;
  rangeEnd: Date | null;
};

const PERIOD_IDS: Record<DashboardPeriod, number> = {
  today: 1,
  week: 2,
  month: 3,
  all: 4,
  custom: 5,
};

export function validateReportShareLink(
  link: ReportShareLinkRecord | null,
  {
    expectedType,
    period,
    requestedRange,
    hasViewedCookie,
    now = new Date(),
  }: {
    expectedType: ReportShareLinkType;
    period: DashboardPeriod;
    requestedRange?: DashboardDateRange;
    hasViewedCookie: boolean;
    now?: Date;
  },
): { sucursalId: number; range?: DashboardDateRange } | null {
  if (
    !link ||
    link.type !== expectedType ||
    link.expiresAt <= now ||
    link.views > link.maxViews ||
    !hasViewedCookie ||
    link.targetId % 10 !== PERIOD_IDS[period]
  ) {
    return null;
  }

  const sucursalId = Math.floor(link.targetId / 10);
  if (period !== "custom") return { sucursalId };
  if (!link.rangeStart || !link.rangeEnd || !requestedRange) return null;

  const persistedRange = {
    from: link.rangeStart.toISOString().slice(0, 10),
    to: link.rangeEnd.toISOString().slice(0, 10),
  };
  if (
    persistedRange.from !== requestedRange.from ||
    persistedRange.to !== requestedRange.to
  ) {
    return null;
  }

  return { sucursalId, range: persistedRange };
}
