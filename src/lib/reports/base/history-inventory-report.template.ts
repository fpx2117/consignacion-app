// src/lib/reports/base/history-inventory-report.template.ts
import { MotivoMovimientoStock, TipoMovimientoStock } from "@/lib/types";
import { reportThemeCss } from "@/lib/reports/report-theme";
import { getReportHeadAssets } from "@/lib/reports/tailwind-inline";
import { escapeHtml, escapeAttr, brandInitials } from "@/lib/reports/template-helpers";
import type { BrandingDTO } from "@/lib/reports/types";

export type HistoryInventoryReportRow = {
  id: number;
  productoId: number;
  tipo: TipoMovimientoStock;
  motivo: MotivoMovimientoStock | string;
  cantidad: number;
  stockPrevio: number;
  stockPosterior: number;
  observaciones?: string | null;
  createdAt: Date | string;
  producto: {
    nombre: string;
    codigoBarra?: string | null;
  } | null;
};

const safeStr = (val?: string | null) =>
  val === null || val === undefined ? "-" : escapeHtml(val);

export function buildHistoryInventoryHtml(
  movimientos: HistoryInventoryReportRow[],
  mesNombre: string,
  anio: number,
  branding: BrandingDTO
) {
  // --- 1. CÁLCULOS ---
  const stats = movimientos.reduce(
    (acc, curr) => {
      const cant = Math.abs(Number(curr.cantidad) || 0);
      if (curr.tipo === TipoMovimientoStock.ENTRADA) acc.entradas += cant;
      else acc.salidas += cant;
      return acc;
    },
    { entradas: 0, salidas: 0 }
  );

  const balanceNeto = stats.entradas - stats.salidas;
  const isPositive = balanceNeto >= 0;

  // --- 2. TEMAS Y COLORES (Basado en el Balance) ---
  const theme = {
    titulo: "AUDITORÍA DE MOVIMIENTOS",
    colorPrincipal: isPositive ? "bg-slate-800" : "bg-rose-900",
    colorBorde: isPositive ? "border-slate-900" : "border-rose-900",
    labelTotal: "BALANCE NETO",
    montoTotal: balanceNeto,
    subtituloTotal: isPositive ? "Incremento de Stock" : "Reducción de Stock",
  };

  // Branding
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
        `)}
      </head>

      <body class="p-12 bg-white text-slate-900 max-w-[210mm] mx-auto border-t-[12px] ${theme.colorBorde} min-h-screen flex flex-col">
        
        <div class="flex justify-between items-start border-b-2 border-slate-100 pb-8 mb-8">
          <div class="flex items-center gap-4">
            
            ${branding.logoBase64
      ? `<img src="${escapeAttr(branding.logoBase64)}" class="w-14 h-14 rounded-2xl object-contain bg-white border border-slate-100 shadow-lg" />`
      : `<div class="w-14 h-14 bg-slate-900 text-white flex items-center justify-center rounded-2xl font-black text-2xl shadow-lg">${escapeHtml(
        badge
      )}</div>`
    }

            <div>
              <h1 class="text-2xl font-black tracking-tight text-slate-900">${escapeHtml(brandName)}</h1>
              <p class="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
                ${theme.titulo}
              </p>
              ${metaLine ? `<p class="text-[10px] font-semibold text-slate-400 mt-1">${metaLine}</p>` : ``}
            </div>
          </div>

          <div class="text-right">
            <h2 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Período</h2>
            <div class="flex flex-col items-end">
              <p class="text-4xl font-black text-slate-900 tracking-tighter leading-none uppercase">${escapeHtml(mesNombre)}</p>
              <p class="text-xl font-bold text-slate-400 tracking-tight leading-none">${anio}</p>
            </div>
            <p class="text-[10px] font-bold text-slate-500 uppercase mt-3">Registros: ${movimientos.length}</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-8 mb-10">
          
          <div class="bg-slate-50 rounded-3xl p-8 border border-slate-100 flex flex-col justify-center relative">
            <h3 class="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4">Resumen de Flujo</h3>
            
            <div class="flex justify-between items-center mb-2">
              <span class="text-xs font-bold text-slate-500 uppercase">Entradas Totales</span>
              <span class="text-lg font-black text-emerald-600 money">+${stats.entradas}</span>
            </div>
            <div class="w-full h-px bg-slate-200 mb-2"></div>
            <div class="flex justify-between items-center">
              <span class="text-xs font-bold text-slate-500 uppercase">Salidas Totales</span>
              <span class="text-lg font-black text-rose-600 money">-${stats.salidas}</span>
            </div>

            <div class="absolute top-4 right-4 bg-white text-slate-400 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border border-slate-100 shadow-sm">
              Ref: Unidades
            </div>
          </div>

          <div class="${theme.colorPrincipal} rounded-3xl p-8 text-white flex flex-col justify-center items-end shadow-xl relative overflow-hidden">
            <h3 class="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1 relative z-10">${theme.labelTotal}</h3>
            <p class="text-5xl font-black money tracking-tighter relative z-10">
              ${balanceNeto > 0 ? "+" : ""}${balanceNeto}
            </p>
            <p class="text-[10px] uppercase font-bold text-white/60 mt-2 relative z-10">${theme.subtituloTotal}</p>
            <div class="absolute -bottom-4 -left-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
          </div>
        </div>

        <div class="mb-8 flex-grow">
          <h3 class="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-4 pl-1">
            Detalle de items
          </h3>

          <table class="w-full text-left">
            <thead>
              <tr class="text-[9px] text-slate-400 uppercase font-bold tracking-wider">
                <th class="py-2 pl-4">Fecha</th>
                <th class="py-2">Producto / Motivo</th>
                <th class="py-2 text-center">Tipo</th>
                <th class="py-2 text-center">Cantidad</th>
                <th class="py-2 text-right pr-4">Balance Stock</th>
              </tr>
            </thead>

            <tbody class="text-xs">
              ${movimientos
      .map((m) => {
        const isEntrada = m.tipo === TipoMovimientoStock.ENTRADA;
        const date = new Date(m.createdAt);
        const day = date.getDate().toString().padStart(2, "0");
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const time = date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

        return `
                <tr class="group">
                  <td class="py-4 pl-6 bg-slate-50 rounded-l-2xl border-y border-l border-slate-100 font-bold text-slate-500 text-xs">
                    ${day}/${month} <span class="text-[9px] font-normal text-slate-400 ml-1">${time}</span>
                  </td>
                  
                  <td class="py-4 bg-slate-50 border-y border-slate-100 align-middle">
                    <div class="font-bold text-slate-800 text-sm">${safeStr(m.producto?.nombre)}</div>
                    <div class="text-[9px] font-bold text-slate-400 uppercase tracking-wide mt-0.5">${safeStr(m.motivo).replace(/_/g, " ")}</div>
                  </td>

                  <td class="py-4 text-center bg-slate-50 border-y border-slate-100">
                    ${isEntrada
            ? `<span class="text-[9px] text-emerald-700 font-bold bg-emerald-100 px-2 py-1 rounded border border-emerald-200 uppercase tracking-wider">Entrada</span>`
            : `<span class="text-[9px] text-rose-700 font-bold bg-rose-100 px-2 py-1 rounded border border-rose-200 uppercase tracking-wider">Salida</span>`
          }
                  </td>

                  <td class="py-4 text-center bg-slate-50 border-y border-slate-100">
                    <span class="text-sm font-black money ${isEntrada ? "text-emerald-600" : "text-rose-600"}">
                      ${isEntrada ? "+" : "-"}${m.cantidad}
                    </span>
                  </td>

                  <td class="py-4 text-right pr-6 bg-slate-50 rounded-r-2xl border-y border-r border-slate-100 font-mono text-xs">
                    <span class="text-slate-400 money">${m.stockPrevio}</span>
                    <span class="text-slate-300 mx-1">→</span>
                    <span class="font-black text-slate-900 money">${m.stockPosterior}</span>
                  </td>
                </tr>
              `;
      })
      .join("")}
              
              <tr class="text-[10px] font-bold uppercase text-slate-500">
                <td class="pt-4 pl-6 text-right" colspan="3">Totales del período:</td>
                <td class="pt-4 text-center text-emerald-600">+${stats.entradas}</td>
                <td class="pt-4 text-right pr-6 text-rose-600">-${stats.salidas}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex justify-between items-end mt-4 pt-4 border-t border-slate-100">
          <p class="text-[10px] text-slate-400 uppercase font-medium">Fin del reporte de auditoría</p>
          ${footerText ? `<p class="text-[10px] font-semibold text-slate-400">${footerText}</p>` : ``}
        </div>
        
      </body>
    </html>
  `;
}
