import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { verifyPdfToken } from "@/lib/crypto"; 
import { buildConsignacionHtml } from "@/lib/reports/consignacion-report-template";
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

    // 1. Seguridad: Validación por token para permitir acceso a Puppeteer
    if (!token || !verifyPdfToken(id, token)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // 2. Obtener datos DIRECTO DE LA DB
    // Incluimos numeroFolio para que el template muestre el número correlativo del cliente
    const consignacion = await prisma.consignacion.findUnique({
      where: { id },
      include: {
        cliente: true,
        detalles: {
          include: {
            producto: true
          }
        }
      }
    });

    if (!consignacion) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }

    // 3. Generar PDF con Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    
    // Pasamos la consignación al template. 
    // El template ahora recibirá el objeto con numeroFolio incluido.
    const htmlContent = buildConsignacionHtml(consignacion as any);

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

    // 4. Configuración del nombre del archivo para descarga
    // Usamos el nombre del cliente y su numeroFolio para un nombre de archivo amigable
    const clienteNombre = consignacion.cliente.nombre.replace(/\s+/g, '-');
    const folioFormateado = String((consignacion as any).numeroFolio).padStart(4, '0');
    const fileName = `Remito-${clienteNombre}-${folioFormateado}.pdf`;

    // 5. Retornar PDF con headers optimizados
    return new NextResponse(Buffer.from(pdfUint8Array), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });

  } catch (error: any) {
    console.error("PDF ERROR:", error);
    return NextResponse.json(
      { error: "Error generando PDF" },
      { status: 500 }
    );
  }
}