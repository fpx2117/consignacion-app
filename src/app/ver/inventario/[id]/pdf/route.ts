/* eslint-disable */
// @ts-nocheck
// src/app/ver/inventario/[id]/pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import puppeteer, { Browser } from "puppeteer";
import { prisma } from "@/lib/prisma";

import { getBranding } from "@/lib/reports/get-branding";
import { buildInventoryHtml } from "@/lib/reports/base/inventory-report-template";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let browser: Browser | null = null;

  try {
    const { id } = await params;

    // 1. Determinar si es vista General o Específica
    const isGeneral = id === "all" || id === "0";

    // 2. Obtener sucursales (Filtradas si no es general)
    const sucursales = await prisma.sucursal.findMany({
      where: {
        activa: true,
        ...(!isGeneral && !isNaN(Number(id)) ? { id: Number(id) } : {})
      },
      orderBy: { id: "asc" },
    });

    if (sucursales.length === 0) {
      return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
    }

    // 3. Obtener productos activos
    const productos = await prisma.producto.findMany({
      where: { activo: true },
      include: {
        stockSucursals: true,
      },
      orderBy: { nombre: "asc" },
    });

    // 4. Agrupar productos por sucursal con filtrado ESTRICTO de stock
    const groups = sucursales.map((suc) => {
      const productosEnSucursal = productos
        .map((p) => {
          const stockInfo = p.stockSucursals.find((s) => s.sucursalId === suc.id);

          const stock = stockInfo
            ? stockInfo.stockDisponibleUnits
            : (p.sucursalId === suc.id ? p.stockDisponibleUnits : 0);

          return {
            ...p,
            stockDisponibleUnits: stock,
            stockMinUnits: stockInfo?.stockMinUnits ?? p.stockMinUnits,
          };
        })
        // FILTRADO ESTRICTO: Solo productos con stock positivo en ESTA sucursal.
        // Esto elimina productos de la sucursal 2 apareciendo en la 1 con stock 0.
        .filter((p) => p.stockDisponibleUnits > 0);

      return {
        sucursal: suc.nombre,
        productos: productosEnSucursal,
      };
    }).filter(g => g.productos.length > 0);

    // 5. Branding
    const branding = await getBranding();

    // 6. Generar HTML
    const htmlContent = buildInventoryHtml(groups, branding);

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

    const filename = sucursales.length === 1
      ? `Inventario_${sucursales[0].nombre.replace(/\s+/g, '_')}.pdf`
      : "Inventario_General.pdf";

    return new NextResponse(Buffer.from(pdfUint8Array), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("PDF INVENTARIO ERROR:", error);
    return NextResponse.json({ error: "Error en PDF" }, { status: 500 });
  } finally {
    try {
      if (browser) await browser.close();
    } catch { }
  }
}
