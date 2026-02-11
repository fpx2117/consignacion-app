// src/app/ver/inventario/[id]/pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { prisma } from "@/lib/prisma";
import { buildInventoryHtml } from "@/lib/reports/inventory-report-template";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let browser = null;
  try {
    const productos = await prisma.producto.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" }
    });

    const htmlContent = buildInventoryHtml(productos as any);

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    await page.emulateMediaType('screen');

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" }
    });

    await browser.close();
    const finalBuffer = Buffer.from(pdfBuffer);

    return new NextResponse(finalBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Inventario.pdf"`,
      },
    });
  } catch (error) {
    if (browser) await (browser as any).close();
    return NextResponse.json({ error: "Error en PDF" }, { status: 500 });
  }
}