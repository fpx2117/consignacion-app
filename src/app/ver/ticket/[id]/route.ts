// src/app/ver/ticket/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import puppeteer, { Browser } from "puppeteer";
import { verifyPdfToken } from "@/lib/security/pdf-token";
import type { VentaReportDTO } from "@/lib/reports/base/venta-report-template";
import { buildVentaHtmlAsync } from "@/lib/reports/base/venta-report-template";
import { getBranding } from "@/lib/reports/get-branding";
import { prisma } from "@/lib/prisma";
import { hashCode } from "@/lib/share-links";
import { resolveTimezone } from "@/lib/get-configured-tz";

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
      if (link.type !== "TICKET" || link.targetId !== id) return redirectStatus(request, "invalid");
      if (new Date() > link.expiresAt) return redirectStatus(request, "expired");
      if (link.views >= link.maxViews) return redirectStatus(request, "limit");
    } else {
      if (!token || !verifyPdfToken(id, token)) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    }

    const ventaRaw = await prisma.venta.findUnique({
      where: { id },
      include: {
        cliente: true,
        detalles: { include: { producto: true } },
        sesionCaja: { select: { usuarioId: true } },
      },
    });

    if (!ventaRaw) return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });

    const timezone = await resolveTimezone({
      userId: ventaRaw.sesionCaja?.usuarioId ?? null,
      sucursalId: ventaRaw.sucursalId,
    });

    // ── URL del catálogo público para el QR del ticket ─────────────────────────
    const catalogUrl = `${getPublicOrigin(request)}/lista?sucursalId=${ventaRaw.sucursalId}`;

    const reporteData: VentaReportDTO = {
      id: ventaRaw.id,
      numeroVenta: ventaRaw.numeroVenta,
      fecha: ventaRaw.fecha,
      total: Number(ventaRaw.total),
      descuentoGlobal: Number(ventaRaw.descuentoGlobal ?? 0),
      metodoPago: String(ventaRaw.metodoPago ?? "EFECTIVO"),
      clienteNombre: ventaRaw.cliente?.nombre || "Consumidor Final",
      clienteTelefono: ventaRaw.cliente?.telefono || "",
      zonaHoraria: timezone.tz,
      catalogUrl,
      items: ventaRaw.detalles.map((d) => ({
        producto: d.producto.nombre,
        cantidad: d.units,
        precioUnitario: Number(d.precioUnitario),
        descuento: Number(d.descuento ?? 0),
        subtotal: (Number(d.precioUnitario) * d.units) - Number(d.descuento ?? 0),
      })),
    };

    // ✅ Branding desde la DB del environment del cliente
    const branding = await getBranding();

    // ✅ Template base + branding
    const html = await buildVentaHtmlAsync(reporteData, branding);

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30000 });

    const pdfUint8Array = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
    });

    await browser.close();
    browser = null;

    const cleanName = safeFilename(reporteData.clienteNombre);
    const fileName = `Ticket-${id}-${cleanName || "Consumidor-Final"}.pdf`;

    return new NextResponse(Buffer.from(pdfUint8Array), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("PDF TICKET ERROR:", error);
    return NextResponse.json({ error: "Error generando Ticket PDF" }, { status: 500 });
  } finally {
    try {
      if (browser) await browser.close();
    } catch { }
  }
}
