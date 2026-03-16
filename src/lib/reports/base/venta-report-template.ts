import { reportThemeCss } from "@/lib/reports/report-theme";
import { getReportHeadAssets } from "@/lib/reports/tailwind-inline";
import { brandInitials, escapeAttr, escapeHtml, formatDateAR, formatMoneyARS } from "@/lib/reports/template-helpers";
import { generateQRHtml } from "@/lib/reports/qr-helper";
import type { BrandingDTO } from "@/lib/reports/types";

export interface VentaReportDTO {
  id: number;
  numeroVenta?: number | null;
  fecha: Date | string;
  total: number;
  descuentoGlobal?: number;
  metodoPago: string;
  clienteNombre: string;
  clienteTelefono: string;
  zonaHoraria?: string;
  items: Array<{
    producto: string;
    cantidad: number;
    precioUnitario: number;
    descuento: number;
    subtotal: number;
  }>;
}

// ✅ NUEVO FORMATO DE TICKET: SERIE + NÚMERO
const getTicketDetails = (id: number, numeroVenta?: number | null) => {
  const numberToUse = (typeof numeroVenta === 'number' && numeroVenta > 0) ? numeroVenta : id;

  const LIMITE_POR_SERIE = 1000;
  const serie = Math.floor((numberToUse - 1) / LIMITE_POR_SERIE) + 1;
  const numero = ((numberToUse - 1) % LIMITE_POR_SERIE) + 1;

  return {
    serie: String(serie).padStart(2, "0"),
    numero: String(numero).padStart(4, "0"),
    full: `${String(serie).padStart(2, "0")}-${String(numero).padStart(4, "0")}`,
  };
};

// SVG inline para íconos de método de pago (16x16, sin clases Tailwind)
function getMetodoPagoIcon(metodo: string): string {
  const m = metodo.toUpperCase();
  if (m === "EFECTIVO" || m === "CASH") {
    // Billete: rectángulo con líneas horizontales
    return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;flex-shrink:0">
      <rect x="1" y="4" width="14" height="8" rx="1.5" stroke="currentColor" stroke-width="1.4" fill="none"/>
      <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.2" fill="none"/>
      <line x1="3.5" y1="4" x2="3.5" y2="12" stroke="currentColor" stroke-width="1.2"/>
      <line x1="12.5" y1="4" x2="12.5" y2="12" stroke="currentColor" stroke-width="1.2"/>
    </svg>`;
  }
  if (m === "TARJETA" || m === "CARD") {
    // Tarjeta de crédito
    return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;flex-shrink:0">
      <rect x="1" y="3" width="14" height="10" rx="1.5" stroke="currentColor" stroke-width="1.4" fill="none"/>
      <line x1="1" y1="6.5" x2="15" y2="6.5" stroke="currentColor" stroke-width="1.6"/>
      <rect x="3" y="9" width="3.5" height="1.5" rx="0.5" fill="currentColor"/>
    </svg>`;
  }
  if (m === "TRANSFERENCIA" || m === "TRANSFER") {
    // Flechas de transferencia
    return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;flex-shrink:0">
      <path d="M2 5.5H12M12 5.5L9.5 3M12 5.5L9.5 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M14 10.5H4M4 10.5L6.5 8M4 10.5L6.5 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }
  // Default: círculo simple
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;flex-shrink:0">
    <circle cx="8" cy="8" r="5" stroke="currentColor" stroke-width="1.4" fill="none"/>
  </svg>`;
}

function buildVentaBody(data: VentaReportDTO, branding: BrandingDTO, qrHtml: string): string {
  const ticket = getTicketDetails(data.id, data.numeroVenta);
  const tz = data.zonaHoraria ?? "America/Argentina/Buenos_Aires";

  // Color primario del branding (con fallback)
  const primaryColor = branding.primaryColor ?? "#4f46e5";
  const primaryBorderColor = branding.primaryColor ?? "#312e81";

  // Branding values (dinámicos)
  const brandName = branding.businessName || "Consignación";
  const brandBadge = brandInitials(brandName);
  const footerText = branding.footerText ? escapeHtml(branding.footerText) : "";
  const metaLine = [branding.address, branding.phone].filter((v) => typeof v === "string" && v.trim().length > 0);

  const metodoPagoIcon = getMetodoPagoIcon(data.metodoPago);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        ${getReportHeadAssets(`
          ${reportThemeCss(primaryColor)}
          .money { font-feature-settings: "tnum"; font-variant-numeric: tabular-nums; }
          @page { margin: 0; size: A4; }
        `)}
      </head>

      <body class="p-8 bg-white text-slate-900 max-w-[210mm] mx-auto border-t-[12px]" style="border-top-color:${primaryBorderColor}">
        
        <div class="flex justify-between items-start border-b-2 border-slate-100 pb-8 mb-8">
          <div class="flex items-center gap-4">
            
            ${branding.logoBase64
    ? `<img src="${escapeAttr(branding.logoBase64)}" class="w-12 h-12 rounded-2xl object-contain bg-white border border-slate-100 shadow-lg" />`
    : `<div class="w-12 h-12 bg-slate-900 text-white flex items-center justify-center rounded-2xl font-black text-xl shadow-lg">${escapeHtml(
      brandBadge
    )}</div>`
  }

            <div>
              <h1 class="text-2xl font-black tracking-tight text-slate-900">${escapeHtml(brandName)}</h1>
              <p class="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
                Ticket de Venta
              </p>

              ${metaLine.length
    ? `<p class="text-[10px] font-semibold text-slate-400 mt-1">${metaLine
      .map((x) => escapeHtml(String(x)))
      .join(" · ")}</p>`
    : ``
  }
            </div>
          </div>

          <div class="text-right">
            <h2 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">N° de Ticket</h2>
            
            <div class="flex flex-col items-end">
              <span class="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded mb-1">SERIE ${ticket.serie}</span>
              <p class="text-5xl font-black text-slate-900 tracking-tighter leading-none">#${ticket.numero}</p>
            </div>
            
            <div class="flex flex-col gap-1 mt-3">
              <p class="text-[10px] font-bold text-slate-500 uppercase">Fecha: ${formatDateAR(data.fecha, true, tz)}</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-8 mb-10">
          
          <div class="bg-slate-50 rounded-3xl p-8 border border-slate-100 flex flex-col justify-center">
            <h3 class="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">Cliente</h3>
            <p class="text-xl font-black text-slate-800 tracking-tight mb-1 truncate">${escapeHtml(data.clienteNombre)}</p>
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full" style="background-color:${primaryColor}"></span>
              <p class="text-xs font-semibold text-slate-500 uppercase">${escapeHtml(data.clienteTelefono)}</p>
            </div>
          </div>

          <div class="rounded-3xl p-8 text-white flex flex-col justify-center items-end shadow-2xl relative overflow-hidden" style="background-color:${primaryColor}">
            <h3 class="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1 relative z-10">Total Abonado</h3>
            <p class="text-5xl font-black money tracking-tighter relative z-10">${formatMoneyARS(data.total)}</p>
            
            <div class="flex items-center gap-2 mt-4 border-t border-white/20 pt-3 w-full justify-end relative z-10">
              <span class="text-[10px] uppercase font-bold text-white/60">Método de Pago:</span>
              <span class="flex items-center gap-1.5 px-2 py-0.5 bg-white/20 rounded text-[10px] font-bold uppercase tracking-wider">
                <span style="color:rgba(255,255,255,0.9)">${metodoPagoIcon}</span>
                ${escapeHtml(data.metodoPago)}
              </span>
            </div>
            <div class="absolute -bottom-4 -left-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
          </div>
        </div>

        <div class="mb-12">
          <h3 class="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
            <span class="flex-none w-8 h-px bg-slate-200"></span> 
            Detalle de Items
            <span class="flex-1 h-px bg-slate-200"></span> 
          </h3>

          <table class="w-full text-left border-separate border-spacing-y-2">
            <thead>
              <tr class="text-[9px] text-slate-400 uppercase font-black tracking-widest">
                <th class="py-2 pl-4">Producto</th>
                <th class="py-2 text-center">Cant.</th>
                <th class="py-2 text-right">Precio Unit.</th>
                <th class="py-2 text-right">Desc.</th>
                <th class="py-2 text-right pr-4">Subtotal</th>
              </tr>
            </thead>
            <tbody class="text-sm">
              ${data.items
    .map(
      (item) => `
                <tr class="group hover:bg-slate-50/50 transition-colors">
                  <td class="py-4 pl-4 font-bold text-slate-700 bg-slate-50 rounded-l-xl border-y border-l border-slate-100">
                    ${escapeHtml(item.producto)}
                  </td>
                  <td class="py-4 text-center bg-slate-50 border-y border-slate-100">
                    <div class="inline-flex items-center justify-center w-8 h-8 rounded-lg font-black text-xs" style="background-color:${primaryColor}1a;color:${primaryColor}">
                      ${item.cantidad}
                    </div>
                  </td>
                  <td class="py-4 text-right money text-slate-400 bg-slate-50 border-y border-slate-100">
                    ${formatMoneyARS(item.precioUnitario)}
                  </td>
                  <td class="py-4 text-right money text-emerald-600 bg-slate-50 border-y border-slate-100 font-bold">
                    ${item.descuento > 0 ? `-${formatMoneyARS(item.descuento)}` : "-"}
                  </td>
                  <td class="py-4 text-right pr-4 font-black money border-y border-r border-slate-100 bg-slate-50 rounded-r-xl text-slate-900">
                    ${formatMoneyARS(item.subtotal)}
                  </td>
                </tr>
              `
    )
    .join("")}
              ${data.descuentoGlobal && data.descuentoGlobal > 0 ? `
                <tr>
                  <td colspan="4" class="py-3 text-right font-black text-emerald-600 uppercase tracking-widest text-[9px] pr-4">
                    Descuento General
                  </td>
                  <td class="py-3 text-right pr-4 font-black money text-emerald-600 bg-emerald-50 rounded-xl border border-emerald-100">
                    -${formatMoneyARS(data.descuentoGlobal)}
                  </td>
                </tr>
              ` : ""}
            </tbody>
          </table>
        </div>

        <div class="mt-auto border-t border-slate-100 pt-6">
          <div class="flex justify-between items-end">
            <div style="flex:0 0 auto">
              ${qrHtml}
            </div>
            <div class="text-right">
              <p class="text-xs font-bold text-slate-400">Gracias por su compra</p>
              ${footerText ? `<p class="text-[10px] font-semibold text-slate-400 mt-1">${footerText}</p>` : ``}
              <p class="text-3xl font-black money text-slate-900 mt-2">${formatMoneyARS(data.total)}</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Versión async: incluye QR en el footer.
 * Usar en API routes (server-side / Puppeteer).
 */
export async function buildVentaHtmlAsync(data: VentaReportDTO, branding: BrandingDTO): Promise<string> {
  const ticketId = `${data.numeroVenta ?? data.id}`;
  const qrHtml = await generateQRHtml(ticketId, {
    size: 80,
    label: `Ticket #${ticketId}`,
  });
  return buildVentaBody(data, branding, qrHtml);
}

/**
 * Versión sync: sin QR (para preview en cliente / useMemo).
 * Mantener compatibilidad con la página de branding.
 */
export function buildVentaHtml(data: VentaReportDTO, branding: BrandingDTO): string {
  return buildVentaBody(data, branding, "");
}
