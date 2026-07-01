import { NextRequest, NextResponse } from "next/server";
import type { Browser } from "puppeteer-core";
import { launchReportBrowser } from "@/lib/chromium/resolve-executable-path";
import { verifyPdfToken } from "@/lib/security/pdf-token";
import { prisma } from "@/lib/prisma";
import { hashCode } from "@/lib/sharing/share-links";

import { getBranding } from "@/lib/reports/get-branding";
import { buildConsignacionHtml } from "@/lib/reports/base/remito-template";
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

async function resolveRemitoTimezone(consignacion: { sucursalId: number }) {
  // Consignacion no persiste hoy un usuario creador/dueno confiable para el remito.
  // Para no inferir dueños desde relaciones operativas indirectas, este recurso
  // resuelve por sucursal y deja el fallback tecnico encapsulado en el resolver central.
  return resolveTimezone({ sucursalId: consignacion.sucursalId });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let browser: Browser | null = null;

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
      if (link.type !== "REMITO" || link.targetId !== id) return redirectStatus(request, "invalid");
      if (new Date() > link.expiresAt) return redirectStatus(request, "expired");
      if (link.views >= link.maxViews) return redirectStatus(request, "limit");
      // ✅ NO incrementar views acá (ya se hace en /x)
    } else {
      if (!token || !verifyPdfToken(id, token)) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    }

    const consignacion = await prisma.consignacion.findUnique({
      where: { id },
      include: { cliente: true, detalles: { include: { producto: true } } },
    });

    if (!consignacion) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const timezone = await resolveRemitoTimezone(consignacion);

    // ✅ Branding desde la DB del environment del cliente
    const branding = await getBranding();

    browser = await launchReportBrowser();

    const page = await browser.newPage();
    await page.setContent(await buildConsignacionHtml({ ...consignacion, zonaHoraria: timezone.tz }, branding), {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    const pdfUint8Array = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
    });

    await browser.close();
    browser = null;

    const clienteNombre = safeFilename(consignacion.cliente?.nombre || "Cliente");
    const folioFormateado = String(consignacion.numeroFolio ?? consignacion.id).padStart(4, "0");
    const fileName = `Remito-${clienteNombre || "Cliente"}-${folioFormateado}.pdf`;

    return new NextResponse(Buffer.from(pdfUint8Array), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("PDF REMITO ERROR:", error);
    return NextResponse.json({ error: "Error generando PDF" }, { status: 500 });
  } finally {
    try {
      if (browser) await browser.close();
    } catch { }
  }
}
