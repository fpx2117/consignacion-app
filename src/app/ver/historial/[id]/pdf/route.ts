/* eslint-disable */
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import puppeteer, { Browser } from "puppeteer";
import { prisma } from "@/lib/prisma";

import { getBranding } from "@/lib/reports/get-branding";
import { buildHistoryInventoryHtml } from "@/lib/reports/base/history-inventory-report.template";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let browser: Browser | null = null;

  try {
    const { id } = await params;

    // ✅ [id] = MES 0..11
    const mes = Number.parseInt(id, 10);

    const anioParam = new URL(req.url).searchParams.get("anio");
    const anio = Number.parseInt(anioParam || "2026", 10);

    if (!Number.isFinite(mes) || mes < 0 || mes > 11) {
      return NextResponse.json({ error: "Mes inválido (debe ser 0..11)" }, { status: 400 });
    }
    if (!Number.isFinite(anio) || anio < 2000 || anio > 2100) {
      return NextResponse.json({ error: "Año inválido" }, { status: 400 });
    }

    const start = new Date(anio, mes, 1, 0, 0, 0);
    const end = new Date(anio, mes + 1, 0, 23, 59, 59);

    const movimientos = await prisma.movimientoStock.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: { producto: { select: { nombre: true, codigoBarra: true } } },
      orderBy: { createdAt: "desc" },
    });

    const meses = [
      "Enero","Febrero","Marzo","Abril","Mayo","Junio",
      "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
    ];

    // ✅ Branding desde la DB del environment del cliente
    const branding = await getBranding();

    // ✅ Template base + branding
    const html = buildHistoryInventoryHtml(movimientos as any, meses[mes], anio, branding);

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.emulateMediaType("screen");

    const pdfUint8Array = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
    });

    await browser.close();
    browser = null;

    return new NextResponse(Buffer.from(pdfUint8Array), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Auditoria_${meses[mes]}_${anio}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("PDF HISTORY INVENTORY ERROR:", error);
    return NextResponse.json({ error: "Error en PDF" }, { status: 500 });
  } finally {
    try {
      if (browser) await browser.close();
    } catch {}
  }
}
