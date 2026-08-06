import { prisma } from "@/lib/prisma";
import { hashCode } from "@/lib/sharing/share-links";
import type { DashboardDateRange, DashboardPeriod } from "@/lib/types";
import {
  validateReportShareLink,
  type ReportShareLinkType,
} from "@/lib/reports/report-share-link-validation";

export async function resolveReportShareLink({
  code,
  expectedType,
  period,
  requestedRange,
  hasViewedCookie,
}: {
  code: string;
  expectedType: ReportShareLinkType;
  period: DashboardPeriod;
  requestedRange?: DashboardDateRange;
  hasViewedCookie: boolean;
}): Promise<{ sucursalId: number; range?: DashboardDateRange } | null> {
  const link = await prisma.shareLink.findUnique({
    where: { codeHash: hashCode(code) },
  });
  return validateReportShareLink(link, {
    expectedType,
    period,
    requestedRange,
    hasViewedCookie,
  });
}
