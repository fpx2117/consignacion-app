// src/app/ver/remito/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { verifyPdfToken } from "@/lib/crypto";
import { buildConsignacionHtml } from "@/lib/reports/consignacion-report-template";
import { prisma } from "@/lib/prisma";
import { hashCode } from "@/lib/share-links";

export const dynamic = "force-dynamic";

// ✅ Redirect RELATIVO: evita 0.0.0.0:8080
function redirectStatus(state: "invalid" | "expired" | "limit") {
  return NextResponse.redirect(`/x/status?state=${state}`);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let browser: any = null;

  try {
    const { id: idParam } = await params;
    const id = Number(idParam);

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const token = searchParams.get("token");

    // ---------------------------
    // ✅ Seguridad: code (sharelink) o token (legacy)
    // ✅ IMPORTANTE: si elegiste "A" (views en /x),
    //    acá SOLO validamos, NO incrementamos.
    // ---------------------------
    if (code) {
      const codeHash = hashCode(code);

      const link = await prisma.shareLink.findUnique({
        where: { codeHash },
      });

      if (!link) return redirectStatus("invalid");
      if (link.type !== "REMITO" || link.targetId !== id) return redirectStatus("invalid");
      if (new Date() > link.expiresAt) return redirectStatus("expired");
      if (link.views >= link.maxViews) return redirectStatus("limit");

      // ✅ NO incrementar views acá
    } else {
      // fallback token (uso interno / legacy)
      if (!token || !verifyPdfToken(id, token)) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    }

    // ---------------------------
    // Prisma fetch
    // ---------------------------
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

    // ---------------------------
    // PDF con Puppeteer
    // ---------------------------
    browser = await puppeteer.launch({
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
    browser = null;

    const clienteNombre = (consignacion.cliente?.nombre || "Cliente")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-]/gi, "");

    const folioFormateado = String((consignacion as any).numeroFolio ?? consignacion.id).padStart(4, "0");
    const fileName = `Remito-${clienteNombre}-${folioFormateado}.pdf`;

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
    } catch {}
  }
}
