import { reportThemeCss } from "@/lib/reports/report-theme";
import { getReportHeadAssets } from "@/lib/reports/tailwind-inline";
import { escapeHtml, escapeAttr, brandInitials, formatDateAR } from "@/lib/reports/template-helpers";
import type { BrandingDTO } from "@/lib/reports/types";
import { generateBarcodeDataUrl } from "@/lib/reports/barcode-helper";

// formatMoney usa maximumFractionDigits:0 y redondeo entero para cantidades de inventario
const formatMoney = (amount: number) => {
  const safeAmount = Math.round(Number(amount) || 0);
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safeAmount);
};

export interface ProductoInventario {
  nombre?: string;
  stockDisponibleUnits?: number;
  stockMinUnits?: number;
  precioVenta?: number;
  precioCosto?: number;
  fechaVencimiento?: string | Date | null;
  codigoBarra?: string | null;
  [key: string]: unknown;
}

export interface InventoryGroup {
  sucursal: string;
  productos: ProductoInventario[];
}

export async function buildInventoryHtml(
  groups: InventoryGroup[],
  branding: BrandingDTO,
  zonaHoraria?: string,
) {
  const tz = zonaHoraria ?? "America/Argentina/Buenos_Aires";
  // --- 1. PROCESAMIENTO Y CÁLCULOS GLOBALES ---
  let totalItemsGlobal = 0;
  let totalStockUnitsGlobal = 0;
  let valorVentaTotalGlobal = 0;
  let valorCostoTotalGlobal = 0;
  let stockCriticoGlobal = 0;
  let agotadosGlobal = 0;

  const groupsProcesados = groups.map(group => {
    let groupTotalStock = 0;
    let groupValorVenta = 0;

    const itemsProcesados = (group.productos as ProductoInventario[] || []).map((p) => {
      const stock = Number(p.stockDisponibleUnits) || 0;
      const precioVenta = Number(p.precioVenta) || 0;
      const precioCosto = Number(p.precioCosto) || 0;
      const minStock = Number(p.stockMinUnits) || 5;

      groupTotalStock += stock;
      groupValorVenta += precioVenta * stock;
      valorCostoTotalGlobal += precioCosto * stock;

      if (stock === 0) agotadosGlobal++;
      else if (stock <= minStock) stockCriticoGlobal++;

      return {
        ...p,
        stock,
        precioVenta,
        precioCosto,
        subtotalVenta: precioVenta * stock,
        isLow: stock > 0 && stock <= minStock,
        isOut: stock === 0,
      };
    });

    totalItemsGlobal += (group.productos || []).length;
    totalStockUnitsGlobal += groupTotalStock;
    valorVentaTotalGlobal += groupValorVenta;

    // Separar en 3 buckets para renderizado por sección
    type ProcesadoItem = typeof itemsProcesados[number];
    const normales: ProcesadoItem[]  = itemsProcesados.filter(p => !p.isOut && !p.isLow);
    const bajos: ProcesadoItem[]     = itemsProcesados.filter(p => p.isLow);
    const agotados: ProcesadoItem[]  = itemsProcesados.filter(p => p.isOut);

    return {
      ...group,
      productos: itemsProcesados,
      normales,
      bajos,
      agotados,
      totalStock: groupTotalStock,
      valorVenta: groupValorVenta,
    };
  });

  const margenEstimadoTotalGlobal = valorVentaTotalGlobal - valorCostoTotalGlobal;

  // --- Precarga de barcodes en paralelo ---
  const barcodeMap = new Map<string, string>();
  const barcodePromises: Promise<void>[] = [];
  for (const group of groupsProcesados) {
    for (const p of group.productos as ProductoInventario[]) {
      if (p.codigoBarra) {
        const code = String(p.codigoBarra);
        if (!barcodeMap.has(code)) {
          barcodeMap.set(code, ""); // reservar slot
          barcodePromises.push(
            generateBarcodeDataUrl(code, { height: 6, scale: 1 }).then((url) => {
              barcodeMap.set(code, url);
            })
          );
        }
      }
    }
  }
  await Promise.all(barcodePromises);

  // Branding values
  const brandName = branding.businessName || "Consignación";
  const badge = brandInitials(brandName);
  const metaLine = [branding.address, branding.phone]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map(escapeHtml)
    .join(" · ");
  const footerText = branding.footerText ? escapeHtml(branding.footerText) : "";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        ${getReportHeadAssets(`
          ${reportThemeCss(branding.primaryColor)}
          .money { font-feature-settings: "tnum"; font-variant-numeric: tabular-nums; }
          @page { margin: 0; size: A4; }
          table { border-collapse: separate; border-spacing: 0 0.5rem; }
          .branch-header { page-break-after: avoid; }
        `)}
      </head>

      <body class="p-10 bg-white text-slate-900 max-w-[210mm] mx-auto border-t-[12px] border-slate-900 min-h-screen flex flex-col">
        
        <div class="flex justify-between items-start border-b-2 border-slate-100 pb-6 mb-8">
          <div class="flex items-center gap-4">
            
            ${branding.logoBase64
      ? `<img src="${escapeAttr(branding.logoBase64)}" class="w-12 h-12 rounded-xl object-contain bg-white border border-slate-100 shadow-lg" />`
      : `<div class="w-12 h-12 bg-slate-900 text-white flex items-center justify-center rounded-xl font-black text-xl shadow-lg">${escapeHtml(
        badge
      )}</div>`
    }

            <div>
              <h1 class="text-xl font-black tracking-tight text-slate-900 uppercase">${escapeHtml(brandName)}</h1>
              <p class="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Reporte de Inventario</p>
              ${metaLine ? `<p class="text-[10px] font-semibold text-slate-400 mt-1">${metaLine}</p>` : ``}
            </div>
          </div>

          <div class="text-right">
            <h2 class="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Estado General de Existencias</h2>
            <p class="text-xs font-bold text-slate-600 uppercase">${formatDateAR(new Date(), true, tz)}</p>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-4 mb-8">
          <div class="bg-slate-50 rounded-2xl p-5 border border-slate-100">
            <h3 class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Productos</h3>
            <p class="text-2xl font-black text-slate-800 tracking-tight">${totalItemsGlobal}</p>
            <p class="text-[9px] font-bold text-slate-400 mt-1 uppercase">${totalStockUnitsGlobal} Unidades en sistema</p>
          </div>

          <div class="bg-slate-900 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
            <h3 class="text-[9px] font-black text-white/60 uppercase tracking-widest mb-1 relative z-10">Valuación de Venta</h3>
            <p class="text-2xl font-black money tracking-tighter relative z-10">${formatMoney(valorVentaTotalGlobal)}</p>
            <p class="text-[9px] uppercase font-bold text-white/40 mt-1 relative z-10">Stock actual a PVP</p>
          </div>

          <div class="bg-emerald-600 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
            <h3 class="text-[9px] font-black text-white/60 uppercase tracking-widest mb-1 relative z-10">Margen Potencial</h3>
            <p class="text-2xl font-black money tracking-tighter relative z-10">${formatMoney(margenEstimadoTotalGlobal)}</p>
            <p class="text-[9px] uppercase font-bold text-white/60 mt-1 relative z-10">Utilidad bruta estimada</p>
          </div>
        </div>

        <div class="flex gap-3 mb-8 flex-wrap">
          <div class="px-3 py-1.5 rounded-lg border bg-emerald-50 border-emerald-200 text-emerald-700 text-[10px] font-black uppercase">
            ✓ En Stock: ${totalItemsGlobal - stockCriticoGlobal - agotadosGlobal}
          </div>
          <div class="px-3 py-1.5 rounded-lg border bg-orange-50 border-orange-200 text-orange-700 text-[10px] font-black uppercase">
            ⚠ Stock Bajo: ${stockCriticoGlobal}
          </div>
          <div class="px-3 py-1.5 rounded-lg border bg-red-50 border-red-200 text-red-700 text-[10px] font-black uppercase">
            ✕ Agotados: ${agotadosGlobal}
          </div>
        </div>

        <div class="flex-grow">
          ${groupsProcesados.map(group => {

    // Helper que renderiza una tabla de productos
    type ProcItem = typeof group.normales[number];
    const renderTabla = (items: ProcItem[]) => items.map((p) => {
      const hasExpiry = p.fechaVencimiento != null;
      const expiryDate = hasExpiry ? new Date(p.fechaVencimiento as string | Date) : null;
      const isExpired = expiryDate && expiryDate < new Date();
      const codigoBarra = p.codigoBarra ? String(p.codigoBarra) : null;
      const barcodeUrl = codigoBarra ? barcodeMap.get(codigoBarra) : null;
      const barcodeCell = codigoBarra
        ? barcodeUrl
          ? `<img src="${barcodeUrl}" alt="${escapeHtml(codigoBarra)}" style="display:block;max-height:20px;max-width:120px;" />`
          : `<span style="font-size:8px;color:#94a3b8;font-family:monospace;">${escapeHtml(codigoBarra)}</span>`
        : "";

      return `
        <tr style="background:#f8fafc;">
          <td class="py-2.5 pl-5 rounded-l-xl border-y border-l border-slate-100">
            <div class="font-bold text-slate-800 text-[11px]">${escapeHtml(String(p.nombre ?? ""))}</div>
            ${barcodeCell ? `<div class="mt-0.5">${barcodeCell}</div>` : ""}
          </td>
          <td class="py-2.5 text-center border-y border-slate-100">
            ${hasExpiry
          ? `<div class="inline-flex flex-col items-center">
                <span class="font-bold text-[10px] ${isExpired ? "text-red-600" : "text-slate-600"}">${formatDateAR(p.fechaVencimiento as string | Date, false, tz)}</span>
                ${isExpired ? '<span style="font-size:7px;color:#ef4444;font-weight:900;text-transform:uppercase;letter-spacing:.05em;">Vencido</span>' : ""}
              </div>`
          : '<span style="font-size:9px;color:#cbd5e1;font-style:italic;">No vence</span>'
        }
          </td>
          <td class="py-2.5 text-center border-y border-slate-100">
            <span class="px-2 py-1 rounded-md font-black text-[11px] ${p.isOut ? "bg-red-100 text-red-600" : p.isLow ? "bg-orange-100 text-orange-600" : "bg-emerald-100 text-emerald-700"}">
              ${p.stock}
            </span>
          </td>
          <td class="py-2.5 text-right border-y border-slate-100 text-slate-400 money text-[11px]">${formatMoney(p.precioCosto)}</td>
          <td class="py-2.5 text-right border-y border-slate-100 font-bold text-slate-700 money text-[11px]">${formatMoney(p.precioVenta)}</td>
          <td class="py-2.5 text-right pr-5 rounded-r-xl border-y border-r border-slate-100 font-black text-slate-900 money text-[11px]">${formatMoney(p.subtotalVenta)}</td>
        </tr>`;
    }).join("");

    const tableHead = `
      <table class="w-full text-left mb-3">
        <thead>
          <tr style="font-size:8px;color:#94a3b8;font-weight:900;text-transform:uppercase;letter-spacing:.1em;">
            <th style="padding:6px 0 6px 20px;">Producto</th>
            <th style="padding:6px 0;text-align:center;">Vencimiento</th>
            <th style="padding:6px 0;text-align:center;">Stock</th>
            <th style="padding:6px 0;text-align:right;">Costo</th>
            <th style="padding:6px 0;text-align:right;">Venta</th>
            <th style="padding:6px 0 6px 0;text-align:right;padding-right:20px;">Subtotal</th>
          </tr>
        </thead>
        <tbody>`;

    const tableClose = `</tbody></table>`;

    return `
      <div class="mb-12 last:mb-0">

        <!-- Header de Sucursal -->
        <div class="branch-header flex items-baseline justify-between border-b-2 border-slate-900 mb-6 pb-1">
          <h3 style="font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:.12em;color:#0f172a;">
            SUCURSAL: ${escapeHtml(group.sucursal)}
          </h3>
          <span style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;">
            ${group.productos.length} items · ${group.totalStock} unidades · PVP: ${formatMoney(group.valorVenta)}
          </span>
        </div>

        <!-- SECCIÓN 1: EN STOCK -->
        ${group.normales.length > 0 ? `
          <div class="mb-7">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
              <div style="width:10px;height:10px;border-radius:50%;background:#059669;flex-shrink:0;"></div>
              <span style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.15em;color:#059669;">
                En Stock
              </span>
              <span style="font-size:9px;font-weight:700;color:#94a3b8;margin-left:4px;">
                — ${group.normales.length} producto${group.normales.length !== 1 ? "s" : ""}
              </span>
            </div>
            ${tableHead}${renderTabla(group.normales)}${tableClose}
          </div>
        ` : ""}

        <!-- SECCIÓN 2: STOCK BAJO -->
        ${group.bajos.length > 0 ? `
          <div class="mb-7">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:8px 12px;background:#fff7ed;border-radius:10px;border:1px solid #fed7aa;">
              <div style="width:10px;height:10px;border-radius:50%;background:#d97706;flex-shrink:0;"></div>
              <span style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.15em;color:#d97706;">
                ⚠ Stock Bajo
              </span>
              <span style="font-size:9px;font-weight:700;color:#92400e;margin-left:4px;">
                — ${group.bajos.length} producto${group.bajos.length !== 1 ? "s" : ""} por debajo del mínimo
              </span>
            </div>
            ${tableHead}${renderTabla(group.bajos)}${tableClose}
          </div>
        ` : ""}

        <!-- SECCIÓN 3: AGOTADOS -->
        ${group.agotados.length > 0 ? `
          <div class="mb-7">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:8px 12px;background:#fef2f2;border-radius:10px;border:1px solid #fecaca;">
              <div style="width:10px;height:10px;border-radius:50%;background:#e11d48;flex-shrink:0;"></div>
              <span style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.15em;color:#e11d48;">
                ✕ Agotados
              </span>
              <span style="font-size:9px;font-weight:700;color:#9f1239;margin-left:4px;">
                — ${group.agotados.length} producto${group.agotados.length !== 1 ? "s" : ""} sin stock disponible
              </span>
            </div>
            <table class="w-full text-left mb-3">
              <thead>
                <tr style="font-size:8px;color:#94a3b8;font-weight:900;text-transform:uppercase;letter-spacing:.1em;">
                  <th style="padding:6px 0 6px 20px;">Producto</th>
                  <th style="padding:6px 0;text-align:center;">Vencimiento</th>
                  <th style="padding:6px 0;text-align:center;">Stock</th>
                  <th style="padding:6px 0;text-align:right;">Costo Unit.</th>
                  <th style="padding:6px 0;text-align:right;padding-right:20px;" colspan="2">Precio Venta</th>
                </tr>
              </thead>
              <tbody>
                ${group.agotados.map(p => {
    const hasExpiry = p.fechaVencimiento != null;
    const expiryDate = hasExpiry ? new Date(p.fechaVencimiento as string | Date) : null;
    const isExpired = expiryDate && expiryDate < new Date();
    const codigoBarra = p.codigoBarra ? String(p.codigoBarra) : null;
    const barcodeUrl = codigoBarra ? barcodeMap.get(codigoBarra) : null;
    const barcodeCell = codigoBarra
      ? barcodeUrl
        ? `<img src="${barcodeUrl}" alt="${escapeHtml(codigoBarra)}" style="display:block;max-height:18px;max-width:100px;opacity:.5;" />`
        : `<span style="font-size:8px;color:#94a3b8;font-family:monospace;">${escapeHtml(codigoBarra)}</span>`
      : "";
    return `
      <tr style="background:#fef2f2;opacity:.85;">
        <td style="padding:10px 0 10px 20px;border-top:1px solid #fecaca;border-bottom:1px solid #fecaca;border-left:3px solid #e11d48;border-radius:10px 0 0 10px;">
          <div style="font-weight:700;color:#9f1239;font-size:11px;">${escapeHtml(String(p.nombre ?? ""))}</div>
          ${barcodeCell ? `<div style="margin-top:2px;">${barcodeCell}</div>` : ""}
        </td>
        <td style="padding:10px 0;text-align:center;border-top:1px solid #fecaca;border-bottom:1px solid #fecaca;">
          ${hasExpiry
      ? `<span style="font-size:10px;font-weight:700;color:${isExpired ? "#dc2626" : "#475569"};">${formatDateAR(p.fechaVencimiento as string | Date, false, tz)}</span>`
      : '<span style="font-size:9px;color:#cbd5e1;font-style:italic;">No vence</span>'
    }
        </td>
        <td style="padding:10px 0;text-align:center;border-top:1px solid #fecaca;border-bottom:1px solid #fecaca;">
          <span style="padding:3px 10px;border-radius:6px;font-weight:900;font-size:11px;background:#fee2e2;color:#e11d48;">0</span>
        </td>
        <td style="padding:10px 0;text-align:right;border-top:1px solid #fecaca;border-bottom:1px solid #fecaca;color:#94a3b8;font-size:11px;">${formatMoney(p.precioCosto)}</td>
        <td style="padding:10px 20px 10px 0;text-align:right;border-top:1px solid #fecaca;border-bottom:1px solid #fecaca;border-right:1px solid #fecaca;border-radius:0 10px 10px 0;font-weight:700;color:#dc2626;font-size:11px;" colspan="2">${formatMoney(p.precioVenta)}</td>
      </tr>`;
  }).join("")}
              </tbody>
            </table>
          </div>
        ` : ""}

      </div>`;
  }).join("")}
        </div>

        ${footerText
      ? `
          <div class="mt-auto border-t border-slate-100 pt-6">
            <p class="text-[10px] font-semibold text-slate-400">${footerText}</p>
          </div>
        `
      : `
          <div class="mt-auto border-t border-slate-100 pt-6"></div>
        `
    }

      </body>
    </html>
  `;
}
