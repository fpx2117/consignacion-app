// src/lib/reports/base/pos-report-template.ts
// Reporte de Ventas Directas (POS) - diseño premium con Tailwind
import type { BrandingDTO } from "@/lib/reports/get-branding";

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
  // Resumen
  totalVentas: number;
  cantidadVentas: number;
  totalGanancia: number;
  ingresosCaja: number;
  ticketPromedio: number;
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
// HELPERS
// ─────────────────────────────────────────────
const e = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const ea = (v: unknown) => e(v).replace(/[\r\n]+/g, " ").trim();

const brandInitials = (name: string) => {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "P") + (p[1]?.[0] ?? p[0]?.[1] ?? "S")).toUpperCase();
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

const fmtN = (n: number) =>
  new Intl.NumberFormat("es-AR").format(n);

const METODO_LABEL: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
  OTRO: "Otro",
};

// ─────────────────────────────────────────────
// TEMPLATE
// ─────────────────────────────────────────────
export function buildPosReportHtml(data: PosReportData, branding: BrandingDTO): string {
  const brandName = branding.businessName || "Comercio";
  const badge = brandInitials(brandName);
  const metaLine = [branding.address, branding.phone]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map(e).join(" · ");
  const footerText = branding.footerText ? e(branding.footerText) : "";

  const rentabilidad = data.totalVentas > 0
    ? Math.round((data.totalGanancia / data.totalVentas) * 100)
    : 0;

  // ─ Por método de pago (chips horizontales compactos)
  const metodosHtml = data.pagosPorMetodo.length > 0
    ? `<div class="flex flex-wrap gap-3">${data.pagosPorMetodo.map(m => `
      <div class="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">
        <div>
          <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest block">${e(METODO_LABEL[m.metodo] ?? m.metodo)}</span>
          <span class="text-sm font-black text-slate-900 money">${fmt(m.total)}</span>
        </div>
        <span class="text-[10px] font-bold text-slate-400 border-l border-slate-100 pl-2 ml-1">${fmtN(m.cantidad)}<br/>ops.</span>
      </div>`).join("")}</div>`
    : `<p class="text-xs text-slate-400">Sin datos</p>`;

  // ─ Top productos
  const topHtml = data.topProductos.length > 0
    ? data.topProductos.slice(0, 5).map((p, i) => `
      <tr class="group">
        <td class="py-3 pl-4 bg-slate-50 rounded-l-xl border-y border-l border-slate-100">
          <span class="text-[10px] font-black text-slate-300 w-5 inline-block">${i + 1}</span>
          <span class="text-xs font-bold text-slate-800">${e(p.nombre) || "Sin nombre"}</span>
        </td>
        <td class="py-3 bg-slate-50 border-y border-slate-100 text-center">
          <span class="text-xs font-black text-slate-600 money">${fmtN(p.units)} u.</span>
        </td>
        <td class="py-3 bg-slate-50 border-y border-slate-100 text-right">
          <span class="text-xs font-black text-slate-900 money">${fmt(p.total)}</span>
        </td>
        <td class="py-3 pr-4 bg-slate-50 rounded-r-xl border-y border-r border-slate-100 text-right">
          <span class="text-xs font-black text-emerald-600 money">${fmt(p.ganancia)}</span>
        </td>
      </tr>`).join("")
    : `<tr><td colspan="4" class="py-4 text-center text-xs text-slate-400">Sin ventas en el período</td></tr>`;

  // ─ Tendencia
  const tendHtml = data.tendencia.length > 0
    ? data.tendencia.map(t => `
      <tr>
        <td class="py-2 pl-4 bg-slate-50 rounded-l-xl border-y border-l border-slate-100 text-[10px] font-bold text-slate-500">${e(t.date)}</td>
        <td class="py-2 bg-slate-50 border-y border-slate-100 text-center text-[10px] font-bold text-slate-600">${fmtN(t.cantidad)}</td>
        <td class="py-2 bg-slate-50 border-y border-slate-100 text-center text-[10px] font-bold text-slate-600 money">${fmtN(t.unitsVendidas)} u.</td>
        <td class="py-2 bg-slate-50 border-y border-slate-100 text-right text-[10px] font-black text-slate-900 money">${fmt(t.ventasTotal)}</td>
        <td class="py-2 pr-4 bg-slate-50 rounded-r-xl border-y border-r border-slate-100 text-right text-[10px] font-black text-emerald-600 money">${fmt(t.ganancia)}</td>
      </tr>`).join("")
    : `<tr><td colspan="5" class="py-4 text-center text-xs text-slate-400">Sin datos de tendencia para período histórico.</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');
    body { font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; }
    .money { font-feature-settings: "tnum"; font-variant-numeric: tabular-nums; }
    @page { margin: 0; size: A4; }
    table { border-collapse: separate; border-spacing: 0 0.35rem; }
  </style>
</head>
<body class="p-10 bg-white text-slate-900 max-w-[210mm] mx-auto border-t-[12px] border-sky-700">

  <!-- HEADER -->
  <div class="flex justify-between items-start border-b-2 border-slate-100 pb-8 mb-8">
    <div class="flex items-center gap-4">
      ${branding.logoBase64
      ? `<img src="${ea(branding.logoBase64)}" class="w-14 h-14 rounded-2xl object-contain bg-white border border-slate-100 shadow-lg" />`
      : `<div class="w-14 h-14 bg-sky-700 text-white flex items-center justify-center rounded-2xl font-black text-2xl shadow-lg">${e(badge)}</div>`
    }
      <div>
        <h1 class="text-2xl font-black tracking-tight text-slate-900">${e(brandName)}</h1>
        <p class="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Reporte de Ventas · POS</p>
        ${metaLine ? `<p class="text-[10px] font-semibold text-slate-400 mt-1">${metaLine}</p>` : ""}
      </div>
    </div>
    <div class="text-right">
      <h2 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Período</h2>
      <p class="text-3xl font-black text-slate-900 tracking-tighter leading-none uppercase">${e(data.periodLabel)}</p>
      <p class="text-[10px] font-bold text-slate-400 uppercase mt-2">Generado ${e(data.fechaGeneracion)}</p>
    </div>
  </div>

  <!-- KPIs PRINCIPALES -->
  <div class="grid grid-cols-4 gap-4 mb-6">
    <div class="bg-slate-50 rounded-2xl p-5 border border-slate-100">
      <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ventas totales</p>
      <p class="text-2xl font-black text-slate-900 money leading-tight">${fmt(data.totalVentas)}</p>
      <p class="text-[10px] text-slate-400 mt-1">${fmtN(data.cantidadVentas)} transacciones</p>
    </div>
    <div class="bg-sky-700 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
      <p class="text-[10px] font-black text-white/60 uppercase tracking-widest mb-2 relative z-10">Ganancia Neta</p>
      <p class="text-2xl font-black tracking-tight money leading-tight relative z-10">${fmt(data.totalGanancia)}</p>
      <p class="text-[10px] text-white/60 mt-1 relative z-10">${rentabilidad}% margen</p>
      <div class="absolute -bottom-4 -left-4 w-20 h-20 bg-white/10 rounded-full blur-2xl"></div>
    </div>
    <div class="bg-slate-50 rounded-2xl p-5 border border-slate-100">
      <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ticket Promedio</p>
      <p class="text-2xl font-black text-slate-900 money leading-tight">${fmt(data.ticketPromedio)}</p>
      <p class="text-[10px] text-slate-400 mt-1">por transacción</p>
    </div>
    <div class="bg-slate-50 rounded-2xl p-5 border border-slate-100">
      <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cobros en Caja</p>
      <p class="text-2xl font-black text-slate-900 money leading-tight break-all">${fmt(data.ingresosCaja)}</p>
      <p class="text-[10px] text-slate-400 mt-1">pagos procesados</p>
    </div>
  </div>

  <!-- MÉTODOS DE PAGO -->
  <div class="mb-6">
    <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Métodos de Pago</h3>
    ${metodosHtml}
  </div>

  <!-- TOP PRODUCTOS -->
  <div class="mb-6">
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
    <p class="text-[10px] text-slate-400 uppercase font-medium">Reporte POS · ${e(data.periodLabel)}</p>
    ${footerText ? `<p class="text-[10px] font-semibold text-slate-400">${footerText}</p>` : ""}
  </div>

</body>
</html>`;
}
