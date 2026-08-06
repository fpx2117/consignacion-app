// src/app/api/dashboard/reporte-link/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateShortCode,
  hashCode,
  encryptCode,
  decryptCode,
} from "@/lib/sharing/share-links";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  DashboardDateRangeError,
  parseDashboardDateQuery,
} from "@/lib/dashboard/date-range";

export const dynamic = "force-dynamic";

type Period = "today" | "week" | "month" | "all" | "custom";
type ReportType = "general" | "pos" | "consignacion";

const VALID_TYPES: ReportType[] = ["general", "pos", "consignacion"];

const PERIOD_TARGET_MAP: Record<Period, number> = {
  today: 1,
  week: 2,
  month: 3,
  all: 4,
  custom: 5,
};

// Maps report type to the Prisma ShareLinkType string
const SHARE_LINK_TYPE_MAP: Record<
  ReportType,
  "REPORTE_DASHBOARD" | "REPORTE_POS" | "REPORTE_CONSIGNACION"
> = {
  general: "REPORTE_DASHBOARD",
  pos: "REPORTE_POS",
  consignacion: "REPORTE_CONSIGNACION",
};

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const rawType = searchParams.get("type") ?? "general";

  let dateQuery;
  try {
    dateQuery = parseDashboardDateQuery(searchParams);
  } catch (error) {
    if (error instanceof DashboardDateRangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
  if (!VALID_TYPES.includes(rawType as ReportType)) {
    return NextResponse.json(
      { error: "Tipo de reporte invalido" },
      { status: 400 },
    );
  }

  const { period, range } = dateQuery as {
    period: Period;
    range?: { from: string; to: string };
  };
  const reportType = rawType as ReportType;
  const periodId = PERIOD_TARGET_MAP[period];
  const shareLinkType = SHARE_LINK_TYPE_MAP[reportType];

  // Encode sucursalId into targetId (SucursalId * 10 + PeriodId)
  const sucursalId = auth.activeSucursalId;
  const targetId = sucursalId * 10 + periodId;
  const rangeStart = range ? new Date(`${range.from}T00:00:00.000Z`) : null;
  const rangeEnd = range ? new Date(`${range.to}T00:00:00.000Z`) : null;

  // Reuse existing valid link
  const existing = await prisma.shareLink.findFirst({
    where: {
      type: shareLinkType,
      targetId,
      rangeStart,
      rangeEnd,
      expiresAt: { gt: new Date() },
      views: { lt: 20 },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return NextResponse.json({ url: `/x/${decryptCode(existing.codeEnc)}` });
  }

  const code = generateShortCode(8);
  await prisma.shareLink.create({
    data: {
      codeHash: hashCode(code),
      codeEnc: encryptCode(code),
      type: shareLinkType,
      targetId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hora
      maxViews: 20,
      rangeStart,
      rangeEnd,
    },
  });

  return NextResponse.json({ url: `/x/${code}` });
}
