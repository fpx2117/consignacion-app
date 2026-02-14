// src/app/ver/inventario/[id]/pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import puppeteer, { Browser } from "puppeteer";
import { prisma } from "@/lib/prisma";

import { getBranding } from "@/lib/reports/get-branding";
import { buildInventoryHtml } from "@/lib/reports/base/inventory-report-template";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  let browser: Browser | null = null;

  try {
    const productos = await prisma.producto.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
    });

    // ✅ Branding desde la DB del environment del cliente
    const branding = await getBranding();

    // ✅ Template base + branding
    const htmlContent = buildInventoryHtml(productos as any, branding);

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
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
        "Content-Disposition": `inline; filename="Inventario.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("PDF INVENTARIO ERROR:", error);
    return NextResponse.json({ error: "Error en PDF" }, { status: 500 });
  } finally {
    try {
      if (browser) await browser.close();
    } catch {}
  }
}
