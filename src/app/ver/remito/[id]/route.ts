import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { verifyPdfToken } from "@/lib/crypto";
import { buildConsignacionHtml } from "@/lib/reports/consignacion-report-template";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // ✅ como exige tu Next
) {
  try {
    const { id: idParam } = await params;
    const id = Number(idParam);

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token || !verifyPdfToken(id, token)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const consignacion = await prisma.consignacion.findUnique({
      where: { id },
      include: {
        cliente: true,
        detalles: { include: { producto: true } },
      },
    });

    if (!consignacion) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    const htmlContent = buildConsignacionHtml(consignacion as any);

    await page.setContent(htmlContent, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    const pdfUint8Array = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
    });

    await browser.close();

    const clienteNombre = (consignacion.cliente?.nombre || "Cliente").replace(/\s+/g, "-");
    const folioFormateado = String((consignacion as any).numeroFolio ?? consignacion.id).padStart(4, "0");
    const fileName = `Remito-${clienteNombre}-${folioFormateado}.pdf`;

    return new NextResponse(Buffer.from(pdfUint8Array), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("PDF ERROR:", error);
    return NextResponse.json({ error: "Error generando PDF" }, { status: 500 });
  }
}
