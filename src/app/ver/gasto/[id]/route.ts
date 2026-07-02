// src/app/ver/gasto/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { Page } from "puppeteer-core";
import { getSharedReportBrowser } from "@/lib/chromium/resolve-executable-path";
import { withChromiumSlot, ChromiumBusyError } from "@/lib/chromium/chromium-semaphore";
import { verifyPdfToken } from "@/lib/security/pdf-token";
import type { GastoReportDTO } from "@/lib/reports/base/gasto-report-template";
import { buildGastoHtml } from "@/lib/reports/base/gasto-report-template";
import { getBranding } from "@/lib/reports/get-branding";
import { prisma } from "@/lib/prisma";
import { hashCode } from "@/lib/sharing/share-links";
import { resolveTimezone } from "@/lib/timezone/get-configured-tz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getPublicOrigin(req: NextRequest): string {
    const xfProto = req.headers.get("x-forwarded-proto");
    const xfHost = req.headers.get("x-forwarded-host");
    const host = xfHost || req.headers.get("host");

    if (host) {
        const proto = xfProto || "https";
        return `${proto}://${host}`;
    }

    const envBase = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
    if (envBase.startsWith("http://") || envBase.startsWith("https://")) return envBase.replace(/\/$/, "");
    return `https://${envBase.replace(/\/$/, "")}`;
}

function redirectStatus(req: NextRequest, state: "invalid" | "expired" | "limit") {
    return NextResponse.redirect(new URL(`/x/status?state=${state}`, getPublicOrigin(req)));
}

function safeFilename(input: string) {
    return input
        .normalize("NFKD")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .slice(0, 60);
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let page: Page | null = null;

    try {
        const { id: idParam } = await params;
        const id = Number(idParam);

        if (!Number.isFinite(id) || id <= 0) {
            return NextResponse.json({ error: "ID inválido" }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const code = searchParams.get("code");
        const token = searchParams.get("token");

        if (code) {
            const codeHash = hashCode(code);
            const link = await prisma.shareLink.findUnique({ where: { codeHash } });

            if (!link) return redirectStatus(request, "invalid");
            if (link.type !== "COMPROBANTE_GASTO" || link.targetId !== id) return redirectStatus(request, "invalid");
            if (new Date() > link.expiresAt) return redirectStatus(request, "expired");
            if (link.views >= link.maxViews) return redirectStatus(request, "limit");
        } else {
            if (!token || !verifyPdfToken(id, token)) {
                return NextResponse.json({ error: "No autorizado" }, { status: 403 });
            }
        }

        const gasto = await prisma.gasto.findUnique({
            where: { id },
            include: { categoria: true },
        });

        if (!gasto) return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });

        const timezone = await resolveTimezone({
            userId: gasto.userId ?? null,
            sucursalId: gasto.sucursalId,
        });

        const reporteData: GastoReportDTO = {
            id: gasto.id,
            fecha: gasto.fecha,
            fechaVencimiento: gasto.fechaVencimiento,
            monto: Number(gasto.monto),
            motivo: gasto.motivo,
            estado: gasto.estado,
            categoria: gasto.categoria?.nombre || "Sin Categoría",
            esRecurrente: gasto.esRecurrente,
            frecuencia: gasto.frecuencia,
            zonaHoraria: timezone.tz,
        };

        const branding = await getBranding();
        const html = await buildGastoHtml(reporteData, branding);

        const pdfUint8Array = await withChromiumSlot(async () => {
            const browser = await getSharedReportBrowser();
            page = await browser.newPage();
            await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30000 });

            const bytes = await page.pdf({
                format: "A4",
                printBackground: true,
                margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
            });

            await page.close();
            return bytes;
        });

        const cleanName = safeFilename(gasto.motivo);
        const fileName = `Gasto-${id}-${cleanName || "Comprobante"}.pdf`;

        return new NextResponse(Buffer.from(pdfUint8Array), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `inline; filename="${fileName}"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        if (error instanceof ChromiumBusyError) {
            return NextResponse.json({ error: "Servidor ocupado generando otros reportes, reintentá en unos segundos." }, { status: 503 });
        }
        console.error("PDF GASTO ERROR:", error);
        return NextResponse.json({ error: "Error generando Gasto PDF" }, { status: 500 });
    } finally {
        try {
            await (page as Page | null)?.close();
        } catch { }
    }
}
