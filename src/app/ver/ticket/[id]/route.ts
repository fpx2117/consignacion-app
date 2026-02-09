import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { verifyPdfToken } from "@/lib/crypto";
import { buildVentaHtml, VentaReportDTO } from "@/lib/reports/venta-report-template";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } } // ✅ NO Promise
) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token || !verifyPdfToken(id, token)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const ventaRaw = await prisma.venta.findUnique({
      where: { id },
      include: {
        cliente: true,
        detalles: { include: { producto: true } },
      },
    });

    if (!ventaRaw) {
      return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
    }

    const metodoPagoSeguro = "EFECTIVO";

    const reporteData: VentaReportDTO = {
      id: ventaRaw.id,
      fecha: ventaRaw.fecha,
      total: Number(ventaRaw.total),
      metodoPago: metodoPagoSeguro,
      clienteNombre: ventaRaw.cliente?.nombre || "Consumidor Final",
      clienteTelefono: ventaRaw.cliente?.telefono || "",
      items: ventaRaw.detalles.map((d) => ({
        producto: d.producto.nombre,
        cantidad: d.units,
        precioUnitario: Number(d.precioUnitario),
        subtotal: Number(d.precioUnitario) * d.units,
      })),
    };

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(buildVentaHtml(reporteData), {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    const pdfUint8Array = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
    });

    await browser.close();

    const cleanName = reporteData.clienteNombre.replace(/[^a-z0-9]/gi, "-");
    const fileName = `Ticket-${id}-${cleanName}.pdf`;

    return new NextResponse(Buffer.from(pdfUint8Array), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("PDF TICKET ERROR:", error);
    return NextResponse.json({ error: "Error generando Ticket PDF" }, { status: 500 });
  }
}
