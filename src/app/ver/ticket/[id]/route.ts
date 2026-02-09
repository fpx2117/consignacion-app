import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { verifyPdfToken } from "@/lib/crypto";
// Importamos la interfaz DTO y la función constructora
import { buildVentaHtml, VentaReportDTO } from "@/lib/reports/venta-report-template";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    // 1. Seguridad
    if (!token || !verifyPdfToken(id, token)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // 2. Fetch de Prisma
    const ventaRaw = await prisma.venta.findUnique({
      where: { id },
      include: {
        cliente: true,
        detalles: {
          include: {
            producto: true
          }
        },
        // Si tu esquema tiene pagos relacionados, descomenta esto:
        // pagos: true
      }
    });

    if (!ventaRaw) {
      return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
    }

    // 3. MAPPER (Data Transformation)
    // Aquí sanitizamos los datos para que el template no falle.
    
    // Determinamos el método de pago (lógica de fallback)
    // Si tuvieras ventaRaw.pagos, harías: ventaRaw.pagos[0]?.metodo || "Efectivo"
    // Como estamos asumiendo que el campo no está directo en Venta, ponemos un default seguro.
    const metodoPagoSeguro = "EFECTIVO"; // O "Desconocido"

    const reporteData: VentaReportDTO = {
      id: ventaRaw.id,
      fecha: ventaRaw.fecha,
      total: Number(ventaRaw.total), // Convertimos Decimal a Number
      metodoPago: metodoPagoSeguro,
      
      clienteNombre: ventaRaw.cliente?.nombre || "Consumidor Final",
      clienteTelefono: ventaRaw.cliente?.telefono || "",
      
      items: ventaRaw.detalles.map((d) => ({
        producto: d.producto.nombre,
        cantidad: d.units,
        precioUnitario: Number(d.precioUnitario), // Convertimos Decimal a Number
        subtotal: Number(d.precioUnitario) * d.units
      }))
    };

    // 4. Generar PDF
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    
    // Pasamos el DTO limpio. TypeScript valida que reporteData cumpla con VentaReportDTO.
    const htmlContent = buildVentaHtml(reporteData);

    await page.setContent(htmlContent, {
      waitUntil: "networkidle0",
      timeout: 30000
    });

    const pdfUint8Array = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
    });

    await browser.close();

    // 5. Retornar Respuesta
    const cleanName = reporteData.clienteNombre.replace(/[^a-z0-9]/gi, '-');
    const fileName = `Ticket-${id}-${cleanName}.pdf`;

    return new NextResponse(Buffer.from(pdfUint8Array), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });

  } catch (error: any) {
    console.error("PDF TICKET ERROR:", error);
    return NextResponse.json(
      { error: "Error generando Ticket PDF" },
      { status: 500 }
    );
  }
}