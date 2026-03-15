// src/lib/reports/base/remito-template.ts
import { reportThemeCss } from "@/lib/reports/report-theme";
import type { BrandingDTO } from "@/lib/reports/types";

// Helpers
const e = (v: unknown) =>
    String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

const ea = (v: unknown) => e(v).replace(/[\r\n]+/g, " ").trim();

const fmt = (n: number) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(n) || 0);

const brandInitials = (name: string) => {
    const p = name.trim().split(/\s+/).filter(Boolean);
    return ((p[0]?.[0] ?? "R") + (p[1]?.[0] ?? p[0]?.[1] ?? "T")).toUpperCase();
};

export function buildConsignacionHtml(consignacion: any, branding: BrandingDTO): string {
    const brandName = branding.businessName || "Comercio";
    const badge = brandInitials(brandName);
    const metaLine = [branding.address, branding.phone]
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        .map(e).join(" · ");
    const footerText = branding.footerText ? e(branding.footerText) : "";

    // Cálculos
    let totalConsignado = 0;
    let totalDescuentos = 0;
    let subtotalSinDescuentos = 0;
    const itemsHtml = (consignacion.detalles || []).map((d: any) => {
        const units = Number(d.unitsEntregadas || 0);
        const unitPrice = Number(d.precioUnitario || d.producto?.precioVenta || 0);
        const subtotalBruto = units * unitPrice;
        const discountItem = Number(d.descuento || 0);
        const subtotalFinal = subtotalBruto - discountItem;

        subtotalSinDescuentos += subtotalBruto;
        totalDescuentos += discountItem;
        totalConsignado += subtotalFinal;

        return `
      <tr>
        <td class="py-3 pl-4 border-b border-slate-100">
          <div class="font-bold text-slate-800 text-sm">${e(d.producto?.nombre)}</div>
          ${discountItem > 0 ? `<div class="text-[10px] text-indigo-500 font-bold uppercase tracking-widest mt-0.5">- ${fmt(discountItem)} en desc.</div>` : ""}
        </td>
        <td class="py-3 text-center border-b border-slate-100 text-slate-600 font-medium">
          ${units}
        </td>
        <td class="py-3 text-right border-b border-slate-100 text-slate-600 money">
          ${fmt(unitPrice)}
        </td>
        <td class="py-3 pr-4 text-right border-b border-slate-100 font-black text-slate-900 money">
          ${fmt(subtotalFinal)}
        </td>
      </tr>
    `;
    }).join("");

    const ticketNumber = String(consignacion.numeroFolio || consignacion.id).padStart(4, "0");
    const dateFormatted = new Date(consignacion.fecha || new Date()).toLocaleDateString("es-AR", {
        day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
    });

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    ${reportThemeCss(branding.primaryColor)}
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');
    body { font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; }
    .money { font-feature-settings: "tnum"; font-variant-numeric: tabular-nums; }
    @page { margin: 0; size: A4; }
  </style>
</head>
<body class="p-10 bg-white text-slate-900 max-w-[210mm] mx-auto min-h-screen border-t-[12px] border-emerald-600 flex flex-col">

  <!-- HEADER -->
  <div class="flex justify-between items-start border-b-2 border-slate-100 pb-8 mb-8">
    <div class="flex items-center gap-4">
      ${branding.logoBase64 ? `<img src="${ea(branding.logoBase64)}" class="w-16 h-16 rounded-2xl object-contain bg-white border border-slate-100 shadow-lg" />` : `<div class="w-16 h-16 bg-emerald-600 text-white flex items-center justify-center rounded-2xl font-black text-2xl shadow-lg">${e(badge)}</div>`}
      <div>
        <h1 class="text-3xl font-black tracking-tight text-slate-900">${e(brandName)}</h1>
        <p class="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.2em] mt-1">Remito de Consignación</p>
        ${metaLine ? `<p class="text-xs font-medium text-slate-500 mt-1">${metaLine}</p>` : ""}
      </div>
    </div>
    <div class="text-right">
      <h2 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Comprobante</h2>
      <p class="text-3xl font-black text-slate-900 tracking-tighter leading-none uppercase">#${ticketNumber}</p>
      <p class="text-[10px] font-bold text-slate-400 uppercase mt-2">Emitido el ${e(dateFormatted)}</p>
    </div>
  </div>

  <!-- DATOS DEL CLIENTE -->
  <div class="bg-slate-50 rounded-2xl p-6 border border-slate-100 mb-8 flex items-start justify-between">
    <div>
      <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cliente / Destinatario</p>
      <p class="text-lg font-black text-slate-900">${e(consignacion.cliente?.nombre || "Consumidor")}</p>
      ${consignacion.cliente?.telefono ? `<p class="text-xs text-slate-500 font-medium mt-1">Tel: ${e(consignacion.cliente.telefono)}</p>` : ""}
    </div>
    <div class="text-right">
      <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Estado</p>
      <div class="inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${consignacion.estado === 'ABIERTA' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}">
        ${consignacion.estado || 'ABIERTA'}
      </div>
    </div>
  </div>

  <!-- DETALLE DE ITEMS -->
  <div class="flex-1">
    <table class="w-full">
      <thead>
        <tr class="text-[9px] text-slate-400 uppercase font-bold tracking-wider border-b-2 border-slate-100">
          <th class="py-3 pl-4 text-left">Producto</th>
          <th class="py-3 text-center">Unidades</th>
          <th class="py-3 text-right">Precio Unit.</th>
          <th class="py-3 pr-4 text-right">Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
  </div>

  <!-- TOTALES -->
  <div class="mt-8 flex justify-end">
    <div class="w-72 bg-slate-50 rounded-2xl p-5 border border-slate-100">
      <div class="flex justify-between items-center mb-3">
        <span class="text-xs font-bold text-slate-500">Subtotal</span>
        <span class="text-sm font-black text-slate-700 money">${fmt(subtotalSinDescuentos)}</span>
      </div>
      ${totalDescuentos > 0 ? `
      <div class="flex justify-between items-center mb-4">
        <span class="text-xs font-bold text-indigo-500">Descuentos</span>
        <span class="text-sm font-black text-indigo-600 money">- ${fmt(totalDescuentos)}</span>
      </div>
      ` : ""}
      <div class="border-t-2 border-slate-200 pt-3 flex justify-between items-center">
        <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Consignado</span>
        <span class="text-2xl font-black text-emerald-600 money">${fmt(totalConsignado)}</span>
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="mt-12 pt-6 border-t border-slate-100 flex justify-between items-end">
    <div>
      <p class="text-[10px] text-slate-400 font-semibold">Consignación registrada y valorizada.</p>
      ${footerText ? `<p class="text-[10px] font-semibold text-slate-400 mt-1">${footerText}</p>` : ""}
    </div>
    <div class="text-right">
      <p class="text-[10px] font-black text-slate-300 uppercase tracking-widest">Powered by AllData</p>
    </div>
  </div>

</body>
</html>`;
}
