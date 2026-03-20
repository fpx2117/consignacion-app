// src/lib/reports/base/pos-report-template.ts
// Reporte de Ventas Directas (POS) - diseño premium con Tailwind
import { reportThemeCss } from "@/lib/reports/report-theme";
import { getReportHeadAssets } from "@/lib/reports/tailwind-inline";
import { escapeHtml, escapeAttr, brandInitials, formatNumberAR } from "@/lib/reports/template-helpers";
import type { BrandingDTO } from "@/lib/reports/types";

// ─────────────────────────────────────────────
// DATA TYPES
// ─────────────────────────────────────────────
export type VentaPosRow = {
  fecha: Date;
  numeroVenta: number;
  items: { nombre: string; units: number; precioUnitario: number; subtotal: number }[];
  total: number;
  metodoPago: string;
  clienteNombre: string | null;
  ganancia: number;
};

export type PosReportData = {
  period: string;
  periodLabel: string;
  fechaGeneracion: string;
  scopeLabel?: string;
  // Resumen
  totalVentas: number;
  cantidadVentas: number;
  totalGanancia: number;      // Ganancia Bruta = Σ(subtotal - costo×U) - Desc.Global
  gananciaNeta?: number;     // Ganancia Neta = Bruta - Roturas (sin gastos operativos)
  utilidadNeta?: number;      // Utilidad Neta = Bruta - Gastos - Roturas (resultado final)
  perdidaRotura?: number;     // Pérdida por roturas en ventas anuladas
  roturasDetalle?: { nombre: string; units: number; costoUnitario: number; perdida: number }[]; // Detalle de items rotos
  ingresosCaja: number;
  ticketPromedio: number;
  gastosTotal: number;
  gastosDesglose?: { propios: number; compartidos: number; isGlobal: boolean };
  catalogoVisitas: number;
  // Desglose por método de pago
  pagosPorMetodo: { metodo: string; total: number; cantidad: number }[];
  // Top productos
  topProductos: { nombre: string; units: number; total: number; ganancia: number }[];
  // Detalle ventas (últimas 50)
  ventas: VentaPosRow[];
  // Tendencia diaria
  tendencia: { date: string; ventasTotal: number; cantidad: number; ganancia: number; unitsVendidas: number }[];
};

// ─────────────────────────────────────────────
// HELPERS (locales)
// ─────────────────────────────────────────────
// fmt usa maximumFractionDigits:0 para montos enteros en este reporte
const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

const METODO_LABEL: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
  OTRO: "Otro",
};

// SVG inline para íconos de método de pago (16x16, sin clases Tailwind)
function getMetodoPagoIcon(metodo: string): string {
  const m = metodo.toUpperCase();
  if (m === "EFECTIVO" || m === "CASH") {
    return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;flex-shrink:0">
      <rect x="1" y="4" width="14" height="8" rx="1.5" stroke="currentColor" stroke-width="1.4" fill="none"/>
      <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.2" fill="none"/>
      <line x1="3.5" y1="4" x2="3.5" y2="12" stroke="currentColor" stroke-width="1.2"/>
      <line x1="12.5" y1="4" x2="12.5" y2="12" stroke="currentColor" stroke-width="1.2"/>
    </svg>`;
  }
  if (m === "TARJETA" || m === "CARD") {
    return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;flex-shrink:0">
      <rect x="1" y="3" width="14" height="10" rx="1.5" stroke="currentColor" stroke-width="1.4" fill="none"/>
      <line x1="1" y1="6.5" x2="15" y2="6.5" stroke="currentColor" stroke-width="1.6"/>
      <rect x="3" y="9" width="3.5" height="1.5" rx="0.5" fill="currentColor"/>
    </svg>`;
  }
  if (m === "TRANSFERENCIA" || m === "TRANSFER") {
    return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;flex-shrink:0">
      <path d="M2 5.5H12M12 5.5L9.5 3M12 5.5L9.5 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M14 10.5H4M4 10.5L6.5 8M4 10.5L6.5 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;flex-shrink:0">
    <circle cx="8" cy="8" r="5" stroke="currentColor" stroke-width="1.4" fill="none"/>
  </svg>`;
}

// ─────────────────────────────────────────────
// TEMPLATE
// ─────────────────────────────────────────────
export function buildPosReportHtml(data: PosReportData, branding: BrandingDTO): string {
  const brandName = branding.businessName || "Comercio";
  const badge = brandInitials(brandName);
  const metaLine = [branding.address, branding.phone]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map(escapeHtml).join(" · ");
  const footerText = branding.footerText ? escapeHtml(branding.footerText) : "";

  // Color primario del branding (con fallback sky-700 ≈ #0369A1)
  const primaryColor = branding.primaryColor ?? "#0369A1";

  const rentabilidad = data.totalVentas > 0
    ? Math.round((data.totalGanancia / data.totalVentas) * 100)
    : 0;

  // Usar los valores calculados en el route (ya incluyen roturas)
  const utilidadNeta = data.utilidadNeta ?? (data.totalGanancia - data.gastosTotal);
  const gananciaNeta = data.gananciaNeta ?? data.totalGanancia;
  const perdidaRotura = data.perdidaRotura ?? 0;

  const gastosSubtitle = data.gastosDesglose
    ? data.gastosDesglose.isGlobal
      ? `No compartidos: ${fmt(data.gastosDesglose.propios)} · Compartidos: ${fmt(data.gastosDesglose.compartidos)}`
      : `Propios: ${fmt(data.gastosDesglose.propios)} · Compartidos: ${fmt(data.gastosDesglose.compartidos)}`
    : null;

  // ─ Por método de pago (chips horizontales compactos con ícono SVG)
  const metodosHtml = data.pagosPorMetodo.length > 0
    ? `<div class="flex flex-wrap gap-3">${data.pagosPorMetodo.map(m => `
      <div class="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">
        <span style="color:#64748b">${getMetodoPagoIcon(m.metodo)}</span>
        <div>
          <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest block">${escapeHtml(METODO_LABEL[m.metodo] ?? m.metodo)}</span>
          <span class="text-sm font-black text-slate-900 money">${fmt(m.total)}</span>
        </div>
        <span class="text-[10px] font-bold text-slate-400 border-l border-slate-100 pl-2 ml-1">${formatNumberAR(m.cantidad)}<br/>ops.</span>
      </div>`).join("")}</div>`
    : `<p class="text-xs text-slate-400">Sin datos</p>`;

  // ─ Top productos
  const topHtml = data.topProductos.length > 0
    ? data.topProductos.slice(0, 5).map((p, i) => `
      <tr class="group">
        <td class="py-3 pl-4 bg-slate-50 rounded-l-xl border-y border-l border-slate-100">
          <span class="text-[10px] font-black text-slate-300 w-5 inline-block">${i + 1}</span>
          <span class="text-xs font-bold text-slate-800">${escapeHtml(p.nombre) || "Sin nombre"}</span>
        </td>
        <td class="py-3 bg-slate-50 border-y border-slate-100 text-center">
          <span class="text-xs font-black text-slate-600 money">${formatNumberAR(p.units)} u.</span>
        </td>
        <td class="py-3 bg-slate-50 border-y border-slate-100 text-right">
          <span class="text-xs font-black text-slate-900 money">${fmt(p.total)}</span>
        </td>
        <td class="py-3 pr-4 bg-slate-50 rounded-r-xl border-y border-r border-slate-100 text-right">
          <span class="text-xs font-black text-emerald-600 money">${fmt(p.ganancia)}</span>
        </td>
      </tr>`).join("")
    : `<tr><td colspan="4" class="py-4 text-center text-xs text-slate-400">Sin ventas en el período</td></tr>`;

  // ─ Tendencia con indicador visual (▲ ganancia positiva, ▼ negativa)
  const tendHtml = data.tendencia.length > 0
    ? data.tendencia.map(t => {
      const isPositive = t.ganancia > 0;
      const indicator = isPositive
        ? `<span style="color:#059669;font-size:10px;font-weight:900">▲</span>`
        : `<span style="color:#E11D48;font-size:10px;font-weight:900">▼</span>`;
      return `
      <tr>
        <td class="py-2 pl-4 bg-slate-50 rounded-l-xl border-y border-l border-slate-100 text-[10px] font-bold text-slate-500">${escapeHtml(t.date)}</td>
        <td class="py-2 bg-slate-50 border-y border-slate-100 text-center text-[10px] font-bold text-slate-600">${formatNumberAR(t.cantidad)}</td>
        <td class="py-2 bg-slate-50 border-y border-slate-100 text-center text-[10px] font-bold text-slate-600 money">${formatNumberAR(t.unitsVendidas)} u.</td>
        <td class="py-2 bg-slate-50 border-y border-slate-100 text-right text-[10px] font-black text-slate-900 money">${fmt(t.ventasTotal)}</td>
        <td class="py-2 pr-4 bg-slate-50 rounded-r-xl border-y border-r border-slate-100 text-right text-[10px] font-black money">
          <span style="display:inline-flex;align-items:center;gap:3px;color:${isPositive ? '#059669' : '#E11D48'}">
            ${indicator}${fmt(t.ganancia)}
          </span>
        </td>
      </tr>`;
    }).join("")
    : `<tr><td colspan="5" class="py-4 text-center text-xs text-slate-400">Sin datos de tendencia para período histórico.</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  ${getReportHeadAssets(`
    ${reportThemeCss(primaryColor)}
    .money { font-feature-settings: "tnum"; font-variant-numeric: tabular-nums; }
    @page { margin: 15mm 0 10mm 0; size: A4; }
    @page :first { margin-top: 0; }
    table { border-collapse: separate; border-spacing: 0 0.35rem; }
    /* Evitar que las secciones se corten entre páginas */
    .no-break { break-inside: avoid; page-break-inside: avoid; -webkit-column-break-inside: avoid; }
    .no-break table tbody tr { break-inside: avoid; page-break-inside: avoid; }
  `)}
</head>
<body class="p-10 bg-white text-slate-900 max-w-[210mm] mx-auto border-t-[12px]" style="border-top-color:${primaryColor}">

  <!-- HEADER -->
  <div class="flex justify-between items-start border-b-2 border-slate-100 pb-8 mb-8">
    <div class="flex items-center gap-4">
      ${branding.logoBase64
      ? `<img src="${escapeAttr(branding.logoBase64)}" class="w-14 h-14 rounded-2xl object-contain bg-white border border-slate-100 shadow-lg" />`
      : `<div class="w-14 h-14 text-white flex items-center justify-center rounded-2xl font-black text-2xl shadow-lg" style="background-color:${primaryColor}">${escapeHtml(badge)}</div>`
    }
      <div>
        <h1 class="text-2xl font-black tracking-tight text-slate-900">${escapeHtml(brandName)}</h1>
        <p class="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Reporte de Ventas · POS</p>
        ${data.scopeLabel ? `<p class="text-[10px] font-semibold text-slate-400 mt-1">${escapeHtml(data.scopeLabel)}</p>` : ""}
        ${metaLine ? `<p class="text-[10px] font-semibold text-slate-400 mt-1">${metaLine}</p>` : ""}
      </div>
    </div>
    <div class="text-right">
      <h2 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Período</h2>
      <p class="text-3xl font-black text-slate-900 tracking-tighter leading-none uppercase">${escapeHtml(data.periodLabel)}</p>
      <p class="text-[10px] font-bold text-slate-400 uppercase mt-2">Generado ${escapeHtml(data.fechaGeneracion)}</p>
    </div>
  </div>

  <!-- KPIs PRINCIPALES — Rentabilidad -->
  <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Rentabilidad</p>
  <div class="grid grid-cols-3 gap-4 mb-6 no-break">

    <!-- Ganancia Bruta -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div style="height:3px;background:#059669"></div>
      <div class="p-5">
        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ganancia Bruta</p>
        <p class="text-2xl font-black text-slate-900 money leading-tight">${fmt(data.totalGanancia)}</p>
        <p class="text-[10px] text-slate-400 mt-1">Σ(Subtotal − Costo×U) − Desc.Global</p>
        <p class="text-[10px] text-slate-400">${rentabilidad}% margen sobre ventas</p>
      </div>
    </div>

    <!-- Ganancia Neta -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div style="height:3px;background:#0369a1"></div>
      <div class="p-5">
        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ganancia Neta</p>
        <p class="text-2xl font-black text-slate-900 money leading-tight">${fmt(gananciaNeta)}</p>
        <p class="text-[10px] text-slate-400 mt-1">Bruta − Roturas</p>
        ${perdidaRotura > 0 ? `<p class="text-[9px] text-rose-400 mt-0.5">− ${fmt(perdidaRotura)} en roturas</p>` : ""}
      </div>
    </div>

    <!-- Utilidad Neta -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div style="height:3px;background:${primaryColor}"></div>
      <div class="p-5">
        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Utilidad Neta</p>
        <p class="text-2xl font-black money leading-tight" style="color:${utilidadNeta >= 0 ? '#059669' : '#e11d48'}">${fmt(utilidadNeta)}</p>
        <p class="text-[10px] text-slate-400 mt-1">Bruta − Gastos − Roturas</p>
        ${gastosSubtitle ? `<p class="text-[9px] text-slate-400 mt-0.5">${escapeHtml(gastosSubtitle)}</p>` : ""}
      </div>
    </div>
  </div>

  <!-- KPIs PRINCIPALES — Operaciones -->
  <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Operaciones</p>
  <div class="grid grid-cols-3 gap-4 mb-6 no-break">

    <!-- Ventas Totales -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div style="height:3px;background:#64748b"></div>
      <div class="p-5">
        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ventas Totales</p>
        <p class="text-2xl font-black text-slate-900 money leading-tight">${fmt(data.totalVentas)}</p>
        <p class="text-[10px] text-slate-400 mt-1">${formatNumberAR(data.cantidadVentas)} transacciones</p>
      </div>
    </div>

    <!-- Gastos Totales -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div style="height:3px;background:#e11d48"></div>
      <div class="p-5">
        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Gastos Totales</p>
        <p class="text-2xl font-black text-slate-900 money leading-tight">${fmt(data.gastosTotal)}</p>
        <p class="text-[10px] text-slate-400 mt-1">Propios + Compartidos(proporción)</p>
      </div>
    </div>

    <!-- Ticket Promedio -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div style="height:3px;background:#d97706"></div>
      <div class="p-5">
        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ticket Promedio</p>
        <p class="text-2xl font-black text-slate-900 money leading-tight">${fmt(data.ticketPromedio)}</p>
        <p class="text-[10px] text-slate-400 mt-1">por transacción</p>
      </div>
    </div>

    <!-- Cobros en Caja — accent sky -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div style="height:3px;background:#0369a1"></div>
      <div class="p-5">
        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cobros en Caja</p>
        <p class="text-xl font-black text-slate-900 money leading-tight">${fmt(data.ingresosCaja)}</p>
        <p class="text-[10px] text-slate-400 mt-1">pagos tipo venta procesados</p>
      </div>
    </div>

    <!-- Visitas Catálogo — accent violet -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div style="height:3px;background:#7c3aed"></div>
      <div class="p-5">
        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Visitas Catálogo</p>
        <p class="text-2xl font-black text-slate-900 money leading-tight">${formatNumberAR(data.catalogoVisitas)}</p>
        <p class="text-[10px] text-slate-400 mt-1">visitas en el período</p>
      </div>
    </div>
  </div>

  <!-- MÉTODOS DE PAGO -->
  <div class="mb-6 no-break">
    <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Métodos de Pago</h3>
    ${metodosHtml}
  </div>

  <!-- TOP PRODUCTOS -->
  <div class="mb-6 no-break">
    <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pl-1">Top Productos Vendidos</h3>
    <table class="w-full">
      <thead>
        <tr class="text-[9px] text-slate-400 uppercase font-bold tracking-wider">
          <th class="py-2 pl-4 text-left">Producto</th>
          <th class="py-2 text-center">Uds.</th>
          <th class="py-2 text-right">Total</th>
          <th class="py-2 pr-4 text-right">Ganancia</th>
        </tr>
      </thead>
      <tbody class="text-xs">${topHtml}</tbody>
    </table>
  </div>

  <!-- PÉRDIDA POR ROTURAS — rojo, solo si hay roturas -->
  ${(data.roturasDetalle && data.roturasDetalle.length > 0) ? `
  <div class="mb-6 no-break">
    <h3 class="text-[10px] font-black uppercase tracking-widest mb-3 pl-1" style="color:#e11d48">Pérdida por Roturas</h3>
    <div class="bg-white rounded-2xl border-2 overflow-hidden" style="border-color:#fecdd3">
      <table class="w-full">
        <thead>
          <tr class="text-[9px] text-slate-400 uppercase font-bold tracking-wider" style="background:#fef2f2">
            <th class="py-2 pl-4 text-left">Item</th>
            <th class="py-2 text-center">Cantidad</th>
            <th class="py-2 text-right pr-4">Costo Unit.</th>
            <th class="py-2 text-right pr-4">Pérdida</th>
          </tr>
        </thead>
        <tbody>
          ${data.roturasDetalle.map(r => `
          <tr class="border-t border-slate-100">
            <td class="py-2.5 pl-4 text-[11px] font-bold text-slate-700">${escapeHtml(r.nombre)}</td>
            <td class="py-2.5 text-center text-[11px] text-slate-600">${r.units} u.</td>
            <td class="py-2.5 text-right pr-4 text-[11px] text-slate-600">${fmt(r.costoUnitario)}</td>
            <td class="py-2.5 text-right pr-4 text-[11px] font-black" style="color:#e11d48">${fmt(r.perdida)}</td>
          </tr>`).join("")}
        </tbody>
        <tfoot>
          <tr class="border-t-2 font-bold" style="border-color:#fecdd3;background:#fef2f2">
            <td class="py-2 pl-4 text-[11px] text-slate-700" colspan="3">Total Pérdida por Roturas</td>
            <td class="py-2 text-right pr-4 text-[11px] font-black" style="color:#e11d48">${fmt(data.perdidaRotura ?? 0)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
  ` : ""}

  <!-- TENDENCIA -->
  <div class="mb-8">
    <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pl-1">Tendencia Diaria</h3>
    <table class="w-full">
      <thead>
        <tr class="text-[9px] text-slate-400 uppercase font-bold tracking-wider">
          <th class="py-2 pl-4 text-left">Fecha</th>
          <th class="py-2 text-center">Ops.</th>
          <th class="py-2 text-center">Uds.</th>
          <th class="py-2 text-right">Total ($)</th>
          <th class="py-2 pr-4 text-right">Ganancia</th>
        </tr>
      </thead>
      <tbody class="text-xs">${tendHtml}</tbody>
    </table>
  </div>

  <!-- FOOTER -->
  <div class="flex justify-between items-end pt-4 border-t border-slate-100 mt-6">
    <p class="text-[10px] text-slate-400 uppercase font-medium">Reporte POS · ${escapeHtml(data.periodLabel)}</p>
    ${footerText ? `<p class="text-[10px] font-semibold text-slate-400">${footerText}</p>` : ""}
  </div>

</body>
</html>`;
}
