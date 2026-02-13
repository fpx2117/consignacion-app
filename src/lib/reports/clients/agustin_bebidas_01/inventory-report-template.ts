import { Producto } from "@/lib/types";

// --- Helpers ---
const escapeHtml = (value: unknown): string => {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

const formatDateAR = (date?: string | Date | null, includeTime = true) => {
  if (!date) return "-";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";
  
  return d.toLocaleDateString("es-AR", {
    day: "2-digit", 
    month: "2-digit", 
    year: "numeric",
    ...(includeTime && { hour: "2-digit", minute: "2-digit" })
  });
};

const formatMoney = (amount: number) => {
  // Forzamos que sea un número para evitar el error NaN
  const safeAmount = Math.round(Number(amount) || 0);
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0, // Eliminamos los centavos
    maximumFractionDigits: 0  // Aseguramos que no haya decimales
  }).format(safeAmount);
};

export function buildInventoryHtml(productos: Producto[]) {
  // --- 1. PROCESAMIENTO Y CÁLCULOS (Safe Numbers) ---
  const totalItems = productos.length;
  
  let totalStockUnits = 0;
  let valorVentaTotal = 0;
  let valorCostoTotal = 0;
  let stockCritico = 0;
  let agotados = 0;

  const itemsProcesados = productos.map(p => {
    const stock = Number(p.stockDisponibleUnits) || 0;
    const precioVenta = Number(p.precioVenta) || 0;
    const precioCosto = Number(p.precioCosto) || 0;
    const minStock = Number(p.stockMinUnits) || 5;

    totalStockUnits += stock;
    valorVentaTotal += (precioVenta * stock);
    valorCostoTotal += (precioCosto * stock);

    if (stock === 0) agotados++;
    else if (stock <= minStock) stockCritico++;

    return {
      ...p,
      stock,
      precioVenta,
      precioCosto,
      subtotalVenta: precioVenta * stock,
      isLow: stock > 0 && stock <= minStock,
      isOut: stock === 0
    };
  });

  const margenEstimadoTotal = valorVentaTotal - valorCostoTotal;

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
      <body class="p-10 bg-white text-slate-900 max-w-[210mm] mx-auto border-t-[12px] border-slate-900 min-h-screen flex flex-col">
        
        <div class="flex justify-between items-start border-b-2 border-slate-100 pb-6 mb-8">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 bg-slate-900 text-white flex items-center justify-center rounded-xl font-black text-xl shadow-lg">AD</div>
            <div>
              <h1 class="text-xl font-black tracking-tight text-slate-900 uppercase">AllData POS</h1>
              <p class="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Reporte de Inventario</p>
            </div>
          </div>
          <div class="text-right">
            <h2 class="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Estado de Existencias</h2>
            <p class="text-xs font-bold text-slate-600 uppercase">${formatDateAR(new Date())}</p>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-4 mb-8">
          <div class="bg-slate-50 rounded-2xl p-5 border border-slate-100">
            <h3 class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Productos</h3>
            <p class="text-2xl font-black text-slate-800 tracking-tight">${totalItems}</p>
            <p class="text-[9px] font-bold text-slate-400 mt-1 uppercase">${totalStockUnits} Unidades en sistema</p>
          </div>

          <div class="bg-slate-900 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
            <h3 class="text-[9px] font-black text-white/60 uppercase tracking-widest mb-1 relative z-10">Valuación de Venta</h3>
            <p class="text-2xl font-black money tracking-tighter relative z-10">${formatMoney(valorVentaTotal)}</p>
            <p class="text-[9px] uppercase font-bold text-white/40 mt-1 relative z-10">Stock actual a PVP</p>
          </div>

          <div class="bg-emerald-600 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
            <h3 class="text-[9px] font-black text-white/60 uppercase tracking-widest mb-1 relative z-10">Margen Potencial</h3>
            <p class="text-2xl font-black money tracking-tighter relative z-10">${formatMoney(margenEstimadoTotal)}</p>
            <p class="text-[9px] uppercase font-bold text-white/60 mt-1 relative z-10">Utilidad bruta estimada</p>
          </div>
        </div>

        <div class="flex gap-3 mb-6">
            <div class="px-3 py-1.5 rounded-lg border bg-orange-50 border-orange-200 text-orange-700 text-[10px] font-black uppercase">
                Stock Crítico: ${stockCritico}
            </div>
            <div class="px-3 py-1.5 rounded-lg border bg-red-50 border-red-200 text-red-700 text-[10px] font-black uppercase">
                Agotados: ${agotados}
            </div>
        </div>

        <div class="flex-grow">
          <table class="w-full text-left">
            <thead>
              <tr class="text-[8px] text-slate-400 uppercase font-black tracking-widest">
                <th class="py-2 pl-4">Producto / Detalles</th>
                <th class="py-2 text-center">Vencimiento</th>
                <th class="py-2 text-center">Stock</th>
                <th class="py-2 text-right">Costo</th>
                <th class="py-2 text-right">Venta</th>
                <th class="py-2 text-right pr-4">Subtotal</th>
              </tr>
            </thead>
            <tbody class="text-[11px]">
              ${itemsProcesados.map((p) => {
                const hasExpiry = p.fechaVencimiento != null;
                const expiryDate = hasExpiry ? new Date(p.fechaVencimiento!) : null;
                const isExpired = expiryDate && expiryDate < new Date();
                
                return `
                <tr>
                  <td class="py-3 pl-5 bg-slate-50 rounded-l-xl border-y border-l border-slate-100">
                    <div class="font-bold text-slate-800">${escapeHtml(p.nombre)}</div>
                    <div class="text-[8px] text-slate-400 font-mono mt-0.5 uppercase">${p.codigoBarra ? '• ' + p.codigoBarra : ''}</div>
                  </td>
                  
                  <td class="py-3 text-center bg-slate-50 border-y border-slate-100">
                    ${hasExpiry ? `
                      <div class="inline-flex flex-col">
                        <span class="font-bold ${isExpired ? 'text-red-600' : 'text-slate-600'}">
                          ${formatDateAR(p.fechaVencimiento, false)}
                        </span>
                        ${isExpired ? '<span class="text-[7px] text-red-500 font-black uppercase tracking-tighter">Vencido</span>' : ''}
                      </div>
                    ` : '<span class="text-slate-300 italic text-[9px]">No vence</span>'}
                  </td>

                  <td class="py-3 text-center bg-slate-50 border-y border-slate-100">
                     <span class="px-2 py-1 rounded-md font-black ${p.isOut ? 'bg-red-100 text-red-600' : p.isLow ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-700'}">
                        ${p.stock}
                     </span>
                  </td>

                  <td class="py-3 text-right bg-slate-50 border-y border-slate-100 text-slate-400 money">
                    ${formatMoney(p.precioCosto)}
                  </td>

                  <td class="py-3 text-right bg-slate-50 border-y border-slate-100 font-bold text-slate-700 money">
                    ${formatMoney(p.precioVenta)}
                  </td>

                  <td class="py-3 text-right pr-5 bg-slate-50 rounded-r-xl border-y border-r border-slate-100 font-black text-slate-900 money">
                    ${formatMoney(p.subtotalVenta)}
                  </td>
                </tr>
              `}).join('')}
            </tbody>
          </table>
        </div>

      </body>
    </html>
  `;
}