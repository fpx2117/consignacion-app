import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { prisma } from "@/lib/prisma";
import { buildHistoryInventoryHtml } from "@/lib/reports/history-inventory-report.template";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let browser = null;
  try {
    const { id } = await params;
    const mes = parseInt(id);
    const anio = parseInt(new URL(req.url).searchParams.get("anio") || "2026");

    // Buscamos los movimientos reales
    const movimientos = await prisma.movimientoStock.findMany({
      where: { 
        createdAt: { 
          gte: new Date(anio, mes, 1), 
          lte: new Date(anio, mes + 1, 0, 23, 59, 59) 
        } 
      },
      include: { producto: { select: { nombre: true, codigoBarra: true } } },
      orderBy: { createdAt: "desc" }
    });

    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const html = buildHistoryInventoryHtml(movimientos as any, meses[mes], anio);

    browser = await puppeteer.launch({ 
      headless: true, 
      args: ["--no-sandbox", "--disable-setuid-sandbox"] 
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.emulateMediaType('screen');

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" }
    });

    await browser.close();

    return new NextResponse(Buffer.from(pdfBuffer) as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Auditoria_${meses[mes]}.pdf"`,
      },
    });
  } catch (error) {
    if (browser) await (browser as any).close();
    return NextResponse.json({ error: "Error en PDF" }, { status: 500 });
  }
}