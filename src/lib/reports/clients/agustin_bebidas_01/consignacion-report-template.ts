// src/lib/reports/consignacion-report-template.ts
import { Consignacion } from "@/lib/types";

type ConsignacionReport = Consignacion & { numeroFolio: number };

// --- Helpers ---
const escapeHtml = (value: unknown): string => {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

const formatDateAR = (date?: string | Date | null) => {
  if (!date) return "-";
  const d = new Date(date);
  return isNaN(d.getTime()) ? "-" : d.toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
};

const safeStr = (val?: string | null) => {
  return (val === null || val === undefined) ? "-" : escapeHtml(val);
};

const formatMoney = (amount: number) => {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2
  }).format(amount);
};

const getFolioDetails = (id: number) => String(id).padStart(4, '0');

export function buildConsignacionHtml(c: ConsignacionReport) {
  // --- 1. CÁLCULOS ---
  const porcentajeAumento = c.porcentajeAumento || 0;
  const factorAumento = 1 + (porcentajeAumento / 100);

  let totalVentaEstimada = 0;
  let totalValorMercaderia = 0;
  let totalPendienteValor = 0;

  let sumUnitsEntregadas = 0;
  let sumUnitsVendidas = 0;
  let sumUnitsDevueltas = 0;
  let sumStockPendiente = 0;

  const itemsCalculados = c.detalles?.map(d => {
    const precioBase = Number(d.producto?.precioVenta) ?? 0;
    // Aplicamos el aumento al precio unitario
    const precioFinal = precioBase * factorAumento; 
    
    const subtotalVenta = d.unitsVendidasAcum * precioFinal;
    const valorEntregado = d.unitsEntregadas * precioFinal;
    
    const stockPendiente = d.unitsEntregadas - d.unitsVendidasAcum - d.unitsDevueltasAcum;
    const valorPendiente = stockPendiente * precioFinal;

    totalVentaEstimada += subtotalVenta;
    totalValorMercaderia += valorEntregado;
    totalPendienteValor += valorPendiente;

    sumUnitsEntregadas += d.unitsEntregadas;
    sumUnitsVendidas += d.unitsVendidasAcum;
    sumUnitsDevueltas += d.unitsDevueltasAcum;
    sumStockPendiente += stockPendiente;

    return {
      ...d,
      precioUnitario: precioFinal,
      subtotalVenta: subtotalVenta,
      stockPendiente: stockPendiente
    };
  }) ?? [];

  // --- 2. TEMAS Y COLORES ---
  const hayVentas = totalVentaEstimada > 0;
  const hayStockPendiente = totalPendienteValor > 0;

  let theme = {
    titulo: "ESTADO DE CONSIGNACIÓN",
    colorPrincipal: "bg-blue-600",
    colorBorde: "border-blue-900",
    labelTotal: "VALOR PENDIENTE",
    montoTotal: totalPendienteValor,
    subtituloTotal: "Mercadería en posesión"
  };

  if (hayVentas) {
    theme = {
        titulo: "LIQUIDACIÓN DE VENTAS",
        colorPrincipal: "bg-slate-800",
        colorBorde: "border-slate-900",
        labelTotal: "TOTAL A PAGAR",
        montoTotal: totalVentaEstimada,
        subtituloTotal: "Por unidades vendidas"
    };
  } else if (!hayStockPendiente) {
    theme = {
        titulo: "DEVOLUCIÓN COMPLETA",
        colorPrincipal: "bg-emerald-600",
        colorBorde: "border-emerald-900",
        labelTotal: "SALDO FINAL",
        montoTotal: 0,
        subtituloTotal: "Cuenta saldada"
    };
  }

  const folio = getFolioDetails(c.numeroFolio);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; }
          .money { font-feature-settings: "tnum"; font-variant-numeric: tabular-nums; }
          @page { margin: 0; size: A4; }
          table { border-collapse: separate; border-spacing: 0 0.5rem; }
        </style>
      </head>
      <body class="p-12 bg-white text-slate-900 max-w-[210mm] mx-auto border-t-[12px] ${theme.colorBorde} min-h-screen flex flex-col">
        
        <div class="flex justify-between items-start border-b-2 border-slate-100 pb-8 mb-8">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 bg-slate-900 text-white flex items-center justify-center rounded-2xl font-black text-2xl shadow-lg">AD</div>
            <div>
              <h1 class="text-2xl font-black tracking-tight text-slate-900">AllData POS</h1>
              <p class="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
                ${theme.titulo}
              </p>
            </div>
          </div>
          <div class="text-right">
            <h2 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Folio de Control</h2>
            <div class="flex flex-col items-end">
                <p class="text-5xl font-black text-slate-900 tracking-tighter leading-none">#${folio}</p>
            </div>
            <p class="text-[10px] font-bold text-slate-500 uppercase mt-3">Fecha: ${formatDateAR(c.fecha)}</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-8 mb-10">
          <div class="bg-slate-50 rounded-3xl p-8 border border-slate-100 flex flex-col justify-center relative">
            <h3 class="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">Cliente</h3>
            <p class="text-xl font-black text-slate-800 tracking-tight mb-1 truncate">${safeStr(c.cliente?.nombre)}</p>
            <p class="text-xs font-semibold text-slate-500 uppercase">${safeStr(c.cliente?.telefono)}</p>
            
            ${porcentajeAumento > 0 ? `
              <div class="absolute top-4 right-4 bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border border-emerald-200">
                Aumento Aplicado: ${porcentajeAumento}%
              </div>
            ` : ''}
          </div>

          <div class="${theme.colorPrincipal} rounded-3xl p-8 text-white flex flex-col justify-center items-end shadow-xl relative overflow-hidden">
            <h3 class="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1 relative z-10">${theme.labelTotal}</h3>
            <p class="text-5xl font-black money tracking-tighter relative z-10">${formatMoney(theme.montoTotal)}</p>
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
                <th class="py-2 pl-4">Producto</th>
                <th class="py-2 text-right">Precio Unit.</th>
                <th class="py-2 text-center text-blue-400">Entregado</th>
                <th class="py-2 text-center text-rose-400">Devuelto</th>
                <th class="py-2 text-center text-emerald-500 font-black">Vendido</th>
                <th class="py-2 text-center text-slate-400">Pendiente</th>
                <th class="py-2 text-right pr-4 text-slate-900">Subtotal</th>
              </tr>
            </thead>
            <tbody class="text-xs">
              ${itemsCalculados.map((item) => `
                <tr class="group">
                  <td class="py-4 pl-6 bg-slate-50 rounded-l-2xl border-y border-l border-slate-100 font-bold text-slate-800 text-sm">
                    ${safeStr(item.producto?.nombre)}
                  </td>
                  
                  <td class="py-4 text-right bg-slate-50 border-y border-slate-100 text-slate-400 money pr-2">
                    ${formatMoney(item.precioUnitario)}
                  </td>

                  <td class="py-4 text-center bg-slate-50 border-y border-slate-100">
                     <span class="text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                        ${item.unitsEntregadas}
                     </span>
                  </td>

                  <td class="py-4 text-center bg-slate-50 border-y border-slate-100">
                     ${item.unitsDevueltasAcum > 0 
                        ? `<span class="text-rose-600 font-bold bg-rose-50 px-2 py-1 rounded-md border border-rose-100">${item.unitsDevueltasAcum}</span>` 
                        : '<span class="text-slate-200">-</span>'}
                  </td>

                  <td class="py-4 text-center bg-slate-50 border-y border-slate-100">
                     ${item.unitsVendidasAcum > 0 
                        ? `<span class="text-emerald-700 font-black bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 shadow-sm text-sm">${item.unitsVendidasAcum}</span>`
                        : '<span class="text-slate-200">-</span>'
                     }
                  </td>

                  <td class="py-4 text-center bg-slate-50 border-y border-slate-100">
                     <span class="font-bold ${item.stockPendiente > 0 ? 'text-slate-500' : 'text-slate-200'}">
                        ${item.stockPendiente > 0 ? item.stockPendiente : '-'}
                     </span>
                  </td>

                  <td class="py-4 text-right pr-6 bg-slate-50 rounded-r-2xl border-y border-r border-slate-100 font-black text-slate-900 money text-sm">
                    ${item.subtotalVenta > 0 ? formatMoney(item.subtotalVenta) : '<span class="text-slate-300">-</span>'}
                  </td>
                </tr>
              `).join('')}
              
              <tr class="text-[10px] font-bold uppercase text-slate-500">
                <td class="pt-4 pl-6 text-right" colspan="2">Totales Unidades:</td>
                <td class="pt-4 text-center text-blue-600">${sumUnitsEntregadas}</td>
                <td class="pt-4 text-center text-rose-600">${sumUnitsDevueltas}</td>
                <td class="pt-4 text-center text-emerald-600">${sumUnitsVendidas}</td>
                <td class="pt-4 text-center text-slate-500">${sumStockPendiente}</td>
                <td class="pt-4"></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex justify-end mt-4 pt-4 border-t border-slate-100">
            <div class="w-1/3 bg-slate-50 rounded-xl p-6 border border-slate-100">
                
                ${porcentajeAumento > 0 ? `
                <div class="flex justify-between items-center mb-4 pb-4 border-b border-slate-200 border-dashed">
                    <span class="text-[10px] font-bold text-emerald-600 uppercase">Porcentaje Aplicado</span>
                    <span class="text-xs font-black text-emerald-600">+${porcentajeAumento}%</span>
                </div>
                ` : ''}

                <div class="flex justify-between items-center mb-2">
                    <span class="text-[10px] font-bold text-slate-400 uppercase">Valor Mercadería</span>
                    <span class="text-xs font-bold text-slate-600 money">${formatMoney(totalValorMercaderia)}</span>
                </div>
                <div class="flex justify-between items-center mb-4 pb-4 border-b border-slate-200 border-dashed">
                    <span class="text-[10px] font-bold text-slate-400 uppercase">Valor Pendiente</span>
                    <span class="text-xs font-bold text-slate-600 money">${formatMoney(totalPendienteValor)}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-xs font-black text-slate-900 uppercase">Total Liquidación</span>
                    <span class="text-lg font-black text-slate-900 money">${formatMoney(totalVentaEstimada)}</span>
                </div>
            </div>
        </div>
        
      </body>
    </html>
  `;
}