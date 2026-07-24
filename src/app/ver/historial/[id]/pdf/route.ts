import { NextRequest, NextResponse } from "next/server";
import type { Page } from "puppeteer-core";
import { getSharedReportBrowser } from "@/lib/chromium/resolve-executable-path";
import {
  withChromiumSlot,
  ChromiumBusyError,
} from "@/lib/chromium/chromium-semaphore";
import { prisma } from "@/lib/prisma";
import { getBranding } from "@/lib/reports/get-branding";
import {
  buildHistoryInventoryHtml,
  type HistoryInventoryReportRow,
} from "@/lib/reports/base/history-inventory-report.template";
import { hashCode } from "@/lib/sharing/share-links";
import {
  decodeHistorialShareTarget,
  getHistorialDefaultYear,
} from "@/lib/sharing/historial-share-links";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PublicLinkState = "invalid" | "expired" | "limit";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

function getPublicOrigin(req: NextRequest): string {
  const xfProto = req.headers.get("x-forwarded-proto");
  const xfHost = req.headers.get("x-forwarded-host");
  const host = xfHost || req.headers.get("host");

  if (host) {
    const proto = xfProto || "https";
    return `${proto}://${host}`;
  }

  const envBase =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  if (envBase.startsWith("http://") || envBase.startsWith("https://")) {
    return envBase.replace(/\/$/, "");
  }

  return `https://${envBase.replace(/\/$/, "")}`;
}

function redirectStatus(req: NextRequest, state: PublicLinkState) {
  return NextResponse.redirect(
    new URL(`/x/status?state=${state}`, getPublicOrigin(req)),
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let page: Page | null = null;

  try {
    const { id } = await params;
    const mes = Number.parseInt(id, 10);
    const { searchParams } = new URL(req.url);
    const anio = Number.parseInt(
      searchParams.get("anio") ?? String(getHistorialDefaultYear()),
      10,
    );
    const code = searchParams.get("code");

    if (!Number.isFinite(mes) || mes < 0 || mes > 11) {
      return NextResponse.json(
        { error: "Mes invalido (debe ser 0..11)" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(anio) || anio < 2000 || anio > 2100) {
      return NextResponse.json({ error: "Ano invalido" }, { status: 400 });
    }
    if (!code) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const codeHash = hashCode(code);
    const link = await prisma.shareLink.findUnique({ where: { codeHash } });

    if (!link) return redirectStatus(req, "invalid");
    if (link.type !== "HISTORIAL_INVENTARIO")
      return redirectStatus(req, "invalid");
    if (new Date() > link.expiresAt) return redirectStatus(req, "expired");

    const decodedTarget = decodeHistorialShareTarget(link.targetId);
    if (!decodedTarget) return redirectStatus(req, "invalid");
    if (decodedTarget.mes !== mes || decodedTarget.anio !== anio) {
      return redirectStatus(req, "invalid");
    }

    const cookieName = `v_${codeHash}`;
    const hasViewedCookie = req.cookies.get(cookieName);

    if (!hasViewedCookie && link.views >= link.maxViews) {
      return redirectStatus(req, "limit");
    }

    if (!hasViewedCookie) {
      await prisma.shareLink.update({
        where: { codeHash },
        data: { views: { increment: 1 }, lastViewedAt: new Date() },
      });
    }

    const start = new Date(anio, mes, 1, 0, 0, 0);
    const end = new Date(anio, mes + 1, 0, 23, 59, 59);

    const movimientos = await prisma.movimientoStock.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        ...(decodedTarget.sucursalId === null
          ? {}
          : { sucursalId: decodedTarget.sucursalId }),
      },
      include: { producto: { select: { nombre: true, codigoBarra: true } } },
      orderBy: { createdAt: "desc" },
    });

    const branding = await getBranding(decodedTarget.sucursalId ?? undefined);
    const html = buildHistoryInventoryHtml(
      movimientos as HistoryInventoryReportRow[],
      MESES[mes],
      anio,
      branding,
    );

    const pdfUint8Array = await withChromiumSlot(async () => {
      const browser = await getSharedReportBrowser();
      page = await browser.newPage();
      await page.setContent(html, { waitUntil: "domcontentloaded" });
      await page.emulateMediaType("screen");

      const bytes = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
      });

      await page.close();
      return bytes;
    });

    const response = new NextResponse(Buffer.from(pdfUint8Array), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Auditoria_${MESES[mes]}_${anio}.pdf"`,
        "Cache-Control": "no-store",
      },
    });

    if (!hasViewedCookie) {
      response.cookies.set(cookieName, "1", {
        path: "/",
        maxAge: 60 * 60 * 24,
      });
    }

    return response;
  } catch (error) {
    if (error instanceof ChromiumBusyError) {
      return NextResponse.json(
        {
          error:
            "Servidor ocupado generando otros reportes, reintentá en unos segundos.",
        },
        { status: 503 },
      );
    }
    console.error("PDF HISTORY INVENTORY ERROR:", error);
    return NextResponse.json({ error: "Error en PDF" }, { status: 500 });
  } finally {
    try {
      await (page as Page | null)?.close();
    } catch {}
  }
}
