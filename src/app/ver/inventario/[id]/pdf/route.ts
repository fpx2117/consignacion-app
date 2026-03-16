// src/app/ver/inventario/[id]/pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import puppeteer, { Browser } from "puppeteer";
import { prisma } from "@/lib/prisma";

import { getBranding } from "@/lib/reports/get-branding";
import { buildInventoryHtml, type InventoryGroup } from "@/lib/reports/base/inventory-report-template";
import { getConfiguredTz } from "@/lib/get-configured-tz";

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

    // 4. Agrupar productos por sucursal
    const groups: InventoryGroup[] = sucursales.map((suc) => {
      // Mapear todos los productos con el stock resuelto para esta sucursal
      const todosMapeados = productos.map((p) => {
        const stockInfo = p.stockSucursals.find((s) => s.sucursalId === suc.id);

        // Si no tiene StockSucursal en esta sucursal Y el producto no pertenece a ella, excluir
        // (evita que productos de otra sucursal aparezcan con stock 0 en esta)
        const perteneceASucursal = !!stockInfo || p.sucursalId === suc.id;
        if (!perteneceASucursal) return null;

        const stock = stockInfo
          ? stockInfo.stockDisponibleUnits
          : p.stockDisponibleUnits;

        return {
          id: p.id,
          nombre: p.nombre,
          descripcion: p.descripcion ?? null,
          codigoBarra: p.codigoBarra ?? null,
          sku: p.sku ?? null,
          activo: p.activo,
          precioVenta: Number(p.precioVenta),
          precioCosto: Number(p.precioCosto),
          iva: Number(p.iva),
          stockDisponibleUnits: stock,
          stockConsignadoUnits: p.stockConsignadoUnits,
          stockMinUnits: stockInfo?.stockMinUnits ?? p.stockMinUnits,
          packSizeUnits: p.packSizeUnits ?? null,
          fechaVencimiento: p.fechaVencimiento ? p.fechaVencimiento.toISOString() : null,
          imagenUrl: p.imagenUrl ?? null,
          categoriaId: p.categoriaId ?? null,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        };
      }).filter((p): p is NonNullable<typeof p> => p !== null);

      // Separar en activos (stock > 0) y agotados (stock = 0)
      // Los agotados se incluyen al final del listado con indicador visual
      const conStock = todosMapeados.filter(p => p.stockDisponibleUnits > 0);
      const agotados = todosMapeados.filter(p => p.stockDisponibleUnits === 0);

      // Ordenar: primero los que tienen stock, luego los agotados al final
      const productosOrdenados = [...conStock, ...agotados];

      return {
        sucursal: suc.nombre,
        productos: productosOrdenados,
      };
    }).filter(g => g.productos.length > 0);

    // 5. Branding + timezone
    const branding = await getBranding();
    // Para inventario usamos sucursal 1 como referencia (o la primera sucursal activa)
    const firstSucursalId = sucursales[0]?.id ?? 1;
    const zonaHoraria = await getConfiguredTz(firstSucursalId);

    // 6. Generar HTML
    const htmlContent = await buildInventoryHtml(groups, branding, zonaHoraria);

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "domcontentloaded" });
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
