// src/app/api/dashboard/reporte-link/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateShortCode, hashCode, encryptCode, decryptCode } from "@/lib/share-links";
import { requireAuth } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";

type Period = "today" | "week" | "month" | "all";
type ReportType = "general" | "pos" | "consignacion";

const VALID_PERIODS: Period[] = ["today", "week", "month", "all"];
const VALID_TYPES: ReportType[] = ["general", "pos", "consignacion"];

const PERIOD_TARGET_MAP: Record<Period, number> = {
    today: 1,
    week: 2,
    month: 3,
    all: 4,
};

// Maps report type to the Prisma ShareLinkType string
const SHARE_LINK_TYPE_MAP: Record<ReportType, "REPORTE_DASHBOARD" | "REPORTE_POS" | "REPORTE_CONSIGNACION"> = {
    general: "REPORTE_DASHBOARD",
    pos: "REPORTE_POS",
    consignacion: "REPORTE_CONSIGNACION",
};

export async function GET(req: NextRequest) {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const { searchParams } = new URL(req.url);
    const rawPeriod = searchParams.get("period") ?? "month";
    const rawType = searchParams.get("type") ?? "general";

    if (!VALID_PERIODS.includes(rawPeriod as Period)) {
        return NextResponse.json({ error: "Periodo invalido" }, { status: 400 });
    }
    if (!VALID_TYPES.includes(rawType as ReportType)) {
        return NextResponse.json({ error: "Tipo de reporte invalido" }, { status: 400 });
    }

    const period = rawPeriod as Period;
    const reportType = rawType as ReportType;
    const periodId = PERIOD_TARGET_MAP[period];
    const shareLinkType = SHARE_LINK_TYPE_MAP[reportType];

    // Encode sucursalId into targetId (SucursalId * 10 + PeriodId)
    const sucursalId = auth.activeSucursalId;
    const targetId = (sucursalId * 10) + periodId;

    // Reuse existing valid link
    const existing = await prisma.shareLink.findFirst({
        where: {
            type: shareLinkType,
            targetId,
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
        },
    });

    return NextResponse.json({ url: `/x/${code}` });
}
