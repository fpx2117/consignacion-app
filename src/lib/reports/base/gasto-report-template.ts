import { reportThemeCss } from "@/lib/reports/report-theme";
import type { BrandingDTO } from "@/lib/reports/types";

export interface GastoReportDTO {
    id: number;
    fecha: Date | string;
    fechaVencimiento?: Date | string | null;
    monto: number;
    motivo: string;
    estado: string;
    categoria: string;
    esRecurrente: boolean;
    frecuencia: string;
}

const escapeHtml = (value: unknown): string => {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
};

const escapeAttr = (value: unknown): string => {
    return escapeHtml(value).replace(/[\r\n]+/g, " ").trim();
};

const formatDateAR = (date?: string | Date | null) => {
    if (!date) return "-";
    const d = new Date(date);
    return isNaN(d.getTime())
        ? "-"
        : d.toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
};

const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 2,
    }).format(amount);
};

const brandInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? "A";
    const b = parts[1]?.[0] ?? parts[0]?.[1] ?? "D";
    return (a + b).toUpperCase();
};

export function buildGastoHtml(data: GastoReportDTO, branding: BrandingDTO) {
    const colorPrincipal = "bg-rose-600";
    const colorBorde = "border-rose-900";
    const brandName = branding.businessName || "Consignación";
    const brandBadge = brandInitials(brandName);
    const footerText = branding.footerText ? escapeHtml(branding.footerText) : "";
    const metaLine = [branding.address, branding.phone].filter((v) => typeof v === "string" && v.trim().length > 0);

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          ${reportThemeCss(branding.primaryColor)}
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');
          body { font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; }
          .money { font-feature-settings: "tnum"; font-variant-numeric: tabular-nums; }
          @page { margin: 0; size: A4; }
        </style>
      </head>

      <body class="p-12 bg-white text-slate-900 max-w-[210mm] mx-auto border-t-[12px] ${colorBorde}">
        
        <div class="flex justify-between items-start border-b-2 border-slate-100 pb-8 mb-8">
          <div class="flex items-center gap-4">
            ${branding.logoBase64
            ? `<img src="${escapeAttr(branding.logoBase64)}" class="w-14 h-14 rounded-2xl object-contain bg-white border border-slate-100 shadow-lg" />`
            : `<div class="w-14 h-14 bg-slate-900 text-white flex items-center justify-center rounded-2xl font-black text-2xl shadow-lg">${escapeHtml(brandBadge)}</div>`
        }
            <div>
              <h1 class="text-2xl font-black tracking-tight text-slate-900">${escapeHtml(brandName)}</h1>
              <p class="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Comprobante de Gasto</p>
              ${metaLine.length ? `<p class="text-[10px] font-semibold text-slate-400 mt-1">${metaLine.map((x) => escapeHtml(String(x))).join(" · ")}</p>` : ``}
            </div>
          </div>

          <div class="text-right">
            <h2 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">ID Registro</h2>
            <p class="text-4xl font-black text-slate-900 tracking-tighter leading-none">#G-${String(data.id).padStart(4, "0")}</p>
            <p class="text-[10px] font-bold text-slate-500 uppercase mt-3">Emitido: ${formatDateAR(new Date())}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-8 mb-10">
          <div class="bg-slate-50 rounded-3xl p-8 border border-slate-100">
             <div class="flex justify-between items-start">
                <div>
                   <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Concepto / Motivo</h3>
                   <p class="text-2xl font-black text-slate-900 tracking-tight mb-4">${escapeHtml(data.motivo)}</p>
                   
                   <div class="flex gap-6 mt-4">
                      <div>
                         <h4 class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Categoría</h4>
                         <span class="px-2 py-0.5 bg-slate-200 rounded text-[10px] font-bold text-slate-700 uppercase">${escapeHtml(data.categoria)}</span>
                      </div>
                      <div>
                         <h4 class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Fecha Registro</h4>
                         <span class="text-xs font-bold text-slate-600">${formatDateAR(data.fecha)}</span>
                      </div>
                      ${data.fechaVencimiento ? `
                      <div>
                         <h4 class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Vencimiento</h4>
                         <span class="text-xs font-bold text-orange-600">${formatDateAR(data.fechaVencimiento)}</span>
                      </div>
                      ` : ""}
                   </div>
                </div>

                <div class="${colorPrincipal} rounded-3xl p-8 text-white flex flex-col justify-center items-end shadow-2xl relative overflow-hidden min-w-[200px]">
                  <h3 class="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1 relative z-10">Monto del Egreso</h3>
                  <p class="text-5xl font-black money tracking-tighter relative z-10">${formatMoney(data.monto)}</p>
                  
                  <div class="flex items-center gap-2 mt-4 border-t border-white/20 pt-3 w-full justify-end relative z-10">
                    <span class="text-[10px] uppercase font-bold text-white/60">Estado:</span>
                    <span class="px-2 py-0.5 bg-white/20 rounded text-[10px] font-bold uppercase tracking-wider">${escapeHtml(data.estado)}</span>
                  </div>
                  <div class="absolute -bottom-4 -left-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
                </div>
             </div>
          </div>
        </div>

        ${data.esRecurrente ? `
        <div class="bg-amber-50 border border-amber-100 rounded-3xl p-6 mb-10 flex items-center justify-between">
           <div class="flex items-center gap-4">
              <div class="w-10 h-10 bg-amber-200 rounded-xl flex items-center justify-center">
                 <svg class="w-6 h-6 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
              </div>
              <div>
                 <p class="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-none mb-1">Información de Recurrencia</p>
                 <p class="text-sm font-bold text-amber-900 italic">Este egreso está programado con frecuencia <span class="uppercase">${escapeHtml(data.frecuencia)}</span>.</p>
              </div>
           </div>
        </div>
        ` : ""}

        <div class="mt-auto border-t border-slate-100 pt-6">
          <div class="flex justify-between items-end">
            <div>
              <p class="text-xs font-bold text-slate-400">Comprobante generado por Antigravity POS</p>
              ${footerText ? `<p class="text-[10px] font-semibold text-slate-400 mt-1">${footerText}</p>` : ``}
            </div>
            <div class="text-[9px] font-bold text-slate-300 uppercase tracking-widest">
               Valid Code: ${data.id}-EXPL ${new Date().getFullYear()}
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}
