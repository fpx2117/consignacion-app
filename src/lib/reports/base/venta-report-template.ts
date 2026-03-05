import type { BrandingDTO } from "@/lib/reports/get-branding";

export interface VentaReportDTO {
  id: number;
  fecha: Date | string;
  total: number;
  descuentoGlobal?: number;
  metodoPago: string;
  clienteNombre: string;
  clienteTelefono: string;
  items: Array<{
    producto: string;
    cantidad: number;
    precioUnitario: number;
    descuento: number;
    subtotal: number;
  }>;
}

// --- Helpers ---
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
      hour: "2-digit",
      minute: "2-digit",
    });
};

const formatMoney = (amount: number) => {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(amount);
};

// ✅ NUEVO FORMATO DE TICKET: SERIE + NÚMERO
const getTicketDetails = (id: number) => {
  const LIMITE_POR_SERIE = 100;
  const serie = Math.floor((id - 1) / LIMITE_POR_SERIE) + 1;
  const numero = ((id - 1) % LIMITE_POR_SERIE) + 1;

  return {
    serie: String(serie).padStart(2, "0"),
    numero: String(numero).padStart(3, "0"),
    full: `${String(serie).padStart(2, "0")}-${String(numero).padStart(3, "0")}`,
  };
};

// ✅ Branding → derivamos un “badge” de 2 letras si no hay logo
const brandInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "A";
  const b = parts[1]?.[0] ?? parts[0]?.[1] ?? "D";
  return (a + b).toUpperCase();
};

export function buildVentaHtml(data: VentaReportDTO, branding: BrandingDTO) {
  const ticket = getTicketDetails(data.id);

  // Tailwind classes (se mantienen)
  const colorPrincipal = "bg-indigo-600";
  const colorBorde = "border-indigo-900";
  const colorTextoAccent = "text-indigo-700";
  const colorBgAccent = "bg-indigo-50";

  // Branding values (dinámicos)
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
      : `<div class="w-14 h-14 bg-slate-900 text-white flex items-center justify-center rounded-2xl font-black text-2xl shadow-lg">${escapeHtml(
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
              <p class="text-[10px] font-bold text-slate-500 uppercase">Fecha: ${formatDateAR(data.fecha)}</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-8 mb-10">
          
          <div class="bg-slate-50 rounded-3xl p-8 border border-slate-100 flex flex-col justify-center">
            <h3 class="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">Cliente</h3>
            <p class="text-xl font-black text-slate-800 tracking-tight mb-1 truncate">${escapeHtml(data.clienteNombre)}</p>
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-indigo-400"></span>
              <p class="text-xs font-semibold text-slate-500 uppercase">${escapeHtml(data.clienteTelefono)}</p>
            </div>
          </div>

          <div class="${colorPrincipal} rounded-3xl p-8 text-white flex flex-col justify-center items-end shadow-2xl relative overflow-hidden">
            <h3 class="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1 relative z-10">Total Abonado</h3>
            <p class="text-5xl font-black money tracking-tighter relative z-10">${formatMoney(data.total)}</p>
            
            <div class="flex items-center gap-2 mt-4 border-t border-white/20 pt-3 w-full justify-end relative z-10">
              <span class="text-[10px] uppercase font-bold text-white/60">Método de Pago:</span>
              <span class="px-2 py-0.5 bg-white/20 rounded text-[10px] font-bold uppercase tracking-wider">${escapeHtml(data.metodoPago)}</span>
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
                    <div class="inline-flex items-center justify-center w-8 h-8 rounded-lg ${colorBgAccent} ${colorTextoAccent} font-black text-xs">
                      ${item.cantidad}
                    </div>
                  </td>
                  <td class="py-4 text-right money text-slate-400 bg-slate-50 border-y border-slate-100">
                    ${formatMoney(item.precioUnitario)}
                  </td>
                  <td class="py-4 text-right money text-emerald-600 bg-slate-50 border-y border-slate-100 font-bold">
                    ${item.descuento > 0 ? `-${formatMoney(item.descuento)}` : "-"}
                  </td>
                  <td class="py-4 text-right pr-4 font-black money border-y border-r border-slate-100 bg-slate-50 rounded-r-xl text-slate-900">
                    ${formatMoney(item.subtotal)}
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
                    -${formatMoney(data.descuentoGlobal)}
                  </td>
                </tr>
              ` : ""}
            </tbody>
          </table>
        </div>

        <div class="mt-auto border-t border-slate-100 pt-6">
          <div class="flex justify-between items-end">
            <div>
              <p class="text-xs font-bold text-slate-400">Gracias por su compra</p>
              ${footerText ? `<p class="text-[10px] font-semibold text-slate-400 mt-1">${footerText}</p>` : ``}
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}
