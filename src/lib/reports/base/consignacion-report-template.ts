// src/lib/reports/base/consignacion-report-template.ts
// Reporte de Consignaciones - diseño premium con Tailwind
import { reportThemeCss } from "@/lib/reports/report-theme";
import { getReportHeadAssets } from "@/lib/reports/tailwind-inline";
import { escapeHtml, escapeAttr, brandInitials, formatNumberAR } from "@/lib/reports/template-helpers";
import type { BrandingDTO } from "@/lib/reports/types";

// ─────────────────────────────────────────────
// DATA TYPES
// ─────────────────────────────────────────────
export type ConsigClienteRow = {
  clienteNombre: string;
  folioNumero: number;
  estado: "ABIERTA" | "CERRADA";
  fecha: Date;
  unitsPendientes: number;
  unitsVendidas: number;
  unitsDevueltas: number;
  pagosPendiente: number;
  gananciaGenerada: number;
};

export type ConsigTopProducto = {
  nombre: string;
  unitsEntregadas: number;
  unitsVendidas: number;
  ganancia: number;
};

export type ConsigReportData = {
  period: string;
  periodLabel: string;
  fechaGeneracion: string;
  // Resumen global
  consigAbiertas: number;
  consigCerradas: number;
  unitsPendientesTotal: number;
  unitsVendidasTotal: number;
  unitsEnCalle: number;
  // Finanzas
  gananciaTotal: number;
  saldoPendienteClientes: number;
  liquidacionesRealizadas: number;
  // Top clientes con consignaciones
  topClientes: ConsigClienteRow[];
  // Top productos más consignados
  topProductos: ConsigTopProducto[];
  // Tendencia de liquidaciones diarias
  tendencia: { date: string; liquidaciones: number; ganancia: number; nuevasConsig: number }[];
};

// ─────────────────────────────────────────────
// HELPERS (locales)
// ─────────────────────────────────────────────
// fmt usa maximumFractionDigits:0 para montos enteros en este reporte
const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

// ─────────────────────────────────────────────
// TEMPLATE
// ─────────────────────────────────────────────
export function buildConsigReportHtml(data: ConsigReportData, branding: BrandingDTO): string {
  const brandName = branding.businessName || "Consignacion";
  const badge = brandInitials(brandName);
  const metaLine = [branding.address, branding.phone]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map(escapeHtml).join(" · ");
  const footerText = branding.footerText ? escapeHtml(branding.footerText) : "";

  // Color primario del branding (con fallback indigo-700 ≈ #4338CA)
  const primaryColor = branding.primaryColor ?? "#4338CA";

  const tasaRecuperacion = data.unitsVendidasTotal + data.unitsPendientesTotal > 0
    ? Math.round((data.unitsVendidasTotal / (data.unitsVendidasTotal + data.unitsPendientesTotal)) * 100)
    : 0;

  // Color para la barra de progreso de tasa de rotación
  const tasaColor = tasaRecuperacion >= 60 ? "#059669" : tasaRecuperacion >= 30 ? "#D97706" : "#E11D48";

  // Barra de progreso SVG para tasa de rotación
  const tasaProgressBar = `
    <div style="margin-top:8px;background:#e2e8f0;border-radius:4px;height:6px;overflow:hidden">
      <div style="height:6px;border-radius:4px;background:${tasaColor};width:${Math.min(tasaRecuperacion, 100)}%"></div>
    </div>`;

  // ─ Top clientes
  const clientesHtml = data.topClientes.length > 0
    ? data.topClientes.slice(0, 10).map((c, i) => {
      const isAbierta = c.estado === "ABIERTA";
      return `
        <tr class="group">
          <td class="py-3 pl-4 bg-slate-50 rounded-l-xl border-y border-l border-slate-100">
            <span class="text-[10px] font-black text-slate-300 w-5 inline-block">${i + 1}</span>
            <span class="text-xs font-bold text-slate-800">${escapeHtml(c.clienteNombre)}</span>
            <span class="text-[9px] text-slate-400 ml-1">#${c.folioNumero}</span>
          </td>
          <td class="py-3 bg-slate-50 border-y border-slate-100 text-center">
            ${isAbierta
          ? `<span class="text-[9px] text-emerald-700 font-bold bg-emerald-100 px-2 py-1 rounded border border-emerald-200 uppercase tracking-wider">Abierta</span>`
          : `<span class="text-[9px] text-slate-600 font-bold bg-slate-100 px-2 py-1 rounded border border-slate-200 uppercase tracking-wider">Cerrada</span>`
        }
          </td>
          <td class="py-3 bg-slate-50 border-y border-slate-100 text-center">
            <div class="text-xs font-black ${c.unitsPendientes > 0 ? "text-amber-600" : "text-slate-400"} money">${formatNumberAR(c.unitsPendientes)} u.</div>
            <div class="text-[9px] text-slate-400">pendientes</div>
          </td>
          <td class="py-3 bg-slate-50 border-y border-slate-100 text-right">
            <div class="text-xs font-black text-emerald-600 money">${fmt(c.gananciaGenerada)}</div>
            <div class="text-[9px] text-slate-400">${formatNumberAR(c.unitsVendidas)} vendidas</div>
          </td>
          <td class="py-3 pr-4 bg-slate-50 rounded-r-xl border-y border-r border-slate-100 text-right">
            <div class="text-xs font-black ${c.pagosPendiente > 0 ? "text-rose-600" : "text-slate-400"} money">${c.pagosPendiente > 0 ? fmt(c.pagosPendiente) : "&#8212;"}</div>
            <div class="text-[9px] text-slate-400">saldo</div>
          </td>
        </tr>`;
    }).join("")
    : `<tr><td colspan="5" class="py-4 text-center text-xs text-slate-400">Sin consignaciones en el periodo</td></tr>`;

  // ─ Top productos
  const productosHtml = data.topProductos.length > 0
    ? data.topProductos.slice(0, 5).map((p, i) => {
      const tasaP = p.unitsEntregadas > 0
        ? Math.round((p.unitsVendidas / p.unitsEntregadas) * 100)
        : 0;
      return `
        <div class="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0 gap-4">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-[10px] font-black text-slate-300 shrink-0 w-4">${i + 1}</span>
            <span class="text-xs font-bold text-slate-800 truncate">${escapeHtml(p.nombre)}</span>
          </div>
          <div class="flex items-center gap-4 shrink-0">
            <div class="text-right">
              <div class="text-[10px] font-black text-slate-600 money">${formatNumberAR(p.unitsVendidas)}/${formatNumberAR(p.unitsEntregadas)} u.</div>
              <div class="text-[9px] text-slate-400">${tasaP}% rotacion</div>
            </div>
            <div class="text-right min-w-[80px]">
              <div class="text-xs font-black text-emerald-600 money">${fmt(p.ganancia)}</div>
              <div class="text-[9px] text-slate-400">ganancia</div>
            </div>
          </div>
        </div>`;
    }).join("")
    : `<p class="text-xs text-slate-400 py-4">Sin datos</p>`;

  // ─ Tendencia
  const tendHtml = data.tendencia.length > 0
    ? data.tendencia.map(t => `
      <tr>
        <td class="py-2 pl-4 bg-slate-50 rounded-l-xl border-y border-l border-slate-100 text-[10px] font-bold text-slate-500">${escapeHtml(t.date)}</td>
        <td class="py-2 bg-slate-50 border-y border-slate-100 text-center text-[10px] font-bold text-sky-600">${formatNumberAR(t.nuevasConsig)}</td>
        <td class="py-2 bg-slate-50 border-y border-slate-100 text-center text-[10px] font-bold text-amber-600">${formatNumberAR(t.liquidaciones)}</td>
        <td class="py-2 pr-4 bg-slate-50 rounded-r-xl border-y border-r border-slate-100 text-right text-[10px] font-black text-emerald-600 money">${fmt(t.ganancia)}</td>
      </tr>`).join("")
    : `<tr><td colspan="4" class="py-4 text-center text-xs text-slate-400">Sin datos de tendencia para periodo historico.</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  ${getReportHeadAssets(`
    ${reportThemeCss(primaryColor)}
    .money { font-feature-settings: "tnum"; font-variant-numeric: tabular-nums; }
    @page { margin: 10mm; size: A4; }
    table { border-collapse: separate; border-spacing: 0 0.3rem; }
  `)}
</head>
<body class="p-8 bg-white text-slate-900 w-full border-t-[12px]" style="border-top-color:${primaryColor}">

  <!-- HEADER -->
  <div class="flex justify-between items-start border-b-2 border-slate-100 pb-8 mb-8">
    <div class="flex items-center gap-4">
      ${branding.logoBase64
      ? `<img src="${escapeAttr(branding.logoBase64)}" class="w-14 h-14 rounded-2xl object-contain bg-white border border-slate-100 shadow-lg" />`
      : `<div class="w-14 h-14 text-white flex items-center justify-center rounded-2xl font-black text-2xl shadow-lg" style="background-color:${primaryColor}">${escapeHtml(badge)}</div>`
    }
      <div>
        <h1 class="text-2xl font-black tracking-tight text-slate-900">${escapeHtml(brandName)}</h1>
        <p class="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Reporte de Consignaciones</p>
        ${metaLine ? `<p class="text-[10px] font-semibold text-slate-400 mt-1">${metaLine}</p>` : ""}
      </div>
    </div>
    <div class="text-right">
      <h2 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Periodo</h2>
      <p class="text-3xl font-black text-slate-900 tracking-tighter leading-none uppercase">${escapeHtml(data.periodLabel)}</p>
      <p class="text-[10px] font-bold text-slate-400 uppercase mt-2">Generado ${escapeHtml(data.fechaGeneracion)}</p>
    </div>
  </div>

  <!-- KPIs PRINCIPALES -->
  <div class="grid grid-cols-4 gap-4 mb-8">
    <div class="bg-slate-50 rounded-2xl p-5 border border-slate-100">
      <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Consig. Abiertas</p>
      <p class="text-3xl font-black text-slate-900">${formatNumberAR(data.consigAbiertas)}</p>
      <p class="text-[10px] text-slate-400 mt-1">${formatNumberAR(data.consigCerradas)} cerradas</p>
    </div>
    <div class="rounded-2xl p-5 text-white shadow-xl relative overflow-hidden" style="background-color:${primaryColor}">
      <p class="text-[10px] font-black text-white/60 uppercase tracking-widest mb-2 relative z-10">Ganancia</p>
      <p class="text-3xl font-black tracking-tight money relative z-10">${fmt(data.gananciaTotal)}</p>
      <p class="text-[10px] text-white/60 mt-1 relative z-10">${formatNumberAR(data.liquidacionesRealizadas)} liquidaciones</p>
      <div class="absolute -bottom-4 -left-4 w-20 h-20 bg-white/10 rounded-full blur-2xl"></div>
    </div>
    <div class="bg-slate-50 rounded-2xl p-5 border border-slate-100">
      <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Unidades en Calle</p>
      <p class="text-3xl font-black text-amber-600">${formatNumberAR(data.unitsEnCalle)} <span class="text-lg font-bold">u.</span></p>
      <p class="text-[10px] text-slate-400 mt-1">${formatNumberAR(data.unitsPendientesTotal)} sin liquidar</p>
    </div>
    <div class="bg-slate-50 rounded-2xl p-5 border border-slate-100">
      <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tasa de Rotacion</p>
      <p class="text-3xl font-black" style="color:${tasaColor}">${tasaRecuperacion}%</p>
      <p class="text-[10px] text-slate-400 mt-1">vendidas/entregadas</p>
      ${tasaProgressBar}
    </div>
  </div>

  <!-- SALDO PENDIENTE -->
  ${data.saldoPendienteClientes > 0 ? `
  <div class="bg-rose-50 border border-rose-200 rounded-2xl p-5 mb-6 flex items-center justify-between">
    <div>
      <p class="text-xs font-black text-rose-700 uppercase tracking-widest">Saldo pendiente de clientes</p>
      <p class="text-[10px] text-rose-500 mt-0.5">Deuda acumulada por consignaciones no liquidadas</p>
    </div>
    <p class="text-2xl font-black text-rose-700 money">${fmt(data.saldoPendienteClientes)}</p>
  </div>` : ""}

  <!-- CLIENTES + TOP PRODUCTOS -->
  <div class="grid grid-cols-5 gap-6 mb-8">
    <div class="col-span-3">
      <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pl-1">Consignaciones por Cliente</h3>
      <table class="w-full">
        <thead>
          <tr class="text-[9px] text-slate-400 uppercase font-bold tracking-wider">
            <th class="py-2 pl-4 text-left">Cliente</th>
            <th class="py-2 text-center">Estado</th>
            <th class="py-2 text-center">Pendiente</th>
            <th class="py-2 text-right">Ganancia</th>
            <th class="py-2 pr-4 text-right">Saldo</th>
          </tr>
        </thead>
        <tbody class="text-xs">${clientesHtml}</tbody>
      </table>
    </div>
    <div class="col-span-2">
      <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pl-1">Top Productos</h3>
      <div class="bg-slate-50 rounded-2xl border border-slate-100 p-4">
        ${productosHtml}
      </div>
    </div>
  </div>

  <!-- TENDENCIA -->
  <div class="mb-8">
    <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 pl-1">Tendencia Diaria</h3>
    <table class="w-full">
      <thead>
        <tr class="text-[9px] text-slate-400 uppercase font-bold tracking-wider">
          <th class="py-2 pl-4 text-left">Fecha</th>
          <th class="py-2 text-center">Nuevas Consig.</th>
          <th class="py-2 text-center">Liquidaciones</th>
          <th class="py-2 pr-4 text-right">Ganancia</th>
        </tr>
      </thead>
      <tbody class="text-xs">${tendHtml}</tbody>
    </table>
  </div>

  <!-- FOOTER -->
  <div class="flex justify-between items-end pt-4 border-t border-slate-100 mt-6">
    <p class="text-[10px] text-slate-400 uppercase font-medium">Reporte Consignaciones · ${escapeHtml(data.periodLabel)}</p>
    ${footerText ? `<p class="text-[10px] font-semibold text-slate-400">${footerText}</p>` : ""}
  </div>

</body>
</html>`;
}
