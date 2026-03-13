// src/lib/reports/base/dashboard-report-template.ts
import type { BrandingDTO } from "@/lib/reports/get-branding";
import { brandingHeaderHtml, brandingFooterHtml } from "@/lib/reports/brading-html";

export type DashboardReportData = {
    period: string;
    periodLabel: string;
    fechaGeneracion: string;

    // Finanzas
    gananciaBruta: number;
    gananciaConsignacion: number;
    gananciaDirecta: number;
    gastos: number;
    utilidadNeta: number;
    ingresosCaja: number;
    cantidadVentas: number;
    cantidadPagos: number;

    // Catalogo publico
    catalogoVisitas: number;
    catalogoVisitantesUnicos: number;

    // Stock
    stockDisponible: number;
    stockConsignado: number;

    // Consignaciones
    consignacionesAbiertas: number;
    consignacionesCerradas: number;
    unitsPendientes: number;

    // Tendencia (optional, can be empty array for "all" period)
    tendencia: { date: string; ventasTotal: number; pagosTotal: number }[];

    // Gastos detallados
    gastosDetalle: { motivo: string; categoria: string; monto: number; fecha: string; esCompartido: boolean }[];
};

function escapeHtml(s: unknown): string {
    return String(s ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

function fmt(n: number): string {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 2,
    }).format(n);
}

function fmtN(n: number): string {
    return new Intl.NumberFormat("es-AR").format(n);
}

function kpiBox(label: string, value: string, accent: string, sub?: string): string {
    return `
    <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:14px 16px; min-width:140px; flex:1;">
      <div style="font-size:10px; font-weight:700; color:${accent}; text-transform:uppercase; letter-spacing:.06em; margin-bottom:4px;">${escapeHtml(label)}</div>
      <div style="font-size:20px; font-weight:800; color:#111827; line-height:1.1;">${escapeHtml(value)}</div>
      ${sub ? `<div style="font-size:10px; color:#6b7280; margin-top:3px;">${escapeHtml(sub)}</div>` : ""}
    </div>`;
}

function sectionTitle(title: string, color: string): string {
    return `<h2 style="font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:${color}; border-bottom:2px solid ${color}20; padding-bottom:6px; margin:22px 0 12px;">${escapeHtml(title)}</h2>`;
}

export function buildDashboardReportHtml(data: DashboardReportData, branding: BrandingDTO): string {
    const color = branding.primaryColor || "#294c98";

    const pctConsig = data.gananciaBruta > 0
        ? Math.round((data.gananciaConsignacion / data.gananciaBruta) * 100)
        : 0;
    const pctDirecta = data.gananciaBruta > 0
        ? Math.round((data.gananciaDirecta / data.gananciaBruta) * 100)
        : 0;

    const tendenciaRows = data.tendencia.length > 0
        ? data.tendencia.map((p) => `
        <tr>
          <td style="padding:5px 8px; font-size:11px; border-bottom:1px solid #f3f4f6;">${escapeHtml(p.date)}</td>
          <td style="padding:5px 8px; font-size:11px; border-bottom:1px solid #f3f4f6; text-align:right;">${fmt(p.ventasTotal)}</td>
          <td style="padding:5px 8px; font-size:11px; border-bottom:1px solid #f3f4f6; text-align:right;">${fmt(p.pagosTotal)}</td>
        </tr>`).join("")
        : `<tr><td colspan="3" style="text-align:center; color:#9ca3af; font-size:11px; padding:12px;">Sin datos de tendencia para el período histórico.</td></tr>`;

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background:#fff; color:#111827; padding:20px 24px; font-size:13px; }
    .kpi-row { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:6px; }
    table { width:100%; border-collapse:collapse; }
    th { background:${color}15; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:${color}; padding:6px 8px; border-bottom:2px solid ${color}30; text-align:left; }
    th.right { text-align:right; }
    .tag { display:inline-block; padding:2px 8px; border-radius:99px; font-size:10px; font-weight:700; }
    .badge-period { background:${color}18; color:${color}; padding:3px 10px; border-radius:6px; font-size:10px; font-weight:700; margin-left:8px; vertical-align:middle; }
  </style>
</head>
<body>
  ${brandingHeaderHtml(branding)}

  <div style="margin:14px 0 18px; display:flex; align-items:center; flex-wrap:wrap; gap:8px;">
    <div style="font-size:20px; font-weight:900; color:#111827; letter-spacing:-.02em;">Reporte de Dashboard</div>
    <span class="badge-period">${escapeHtml(data.periodLabel)}</span>
  </div>
  <div style="font-size:10px; color:#9ca3af; margin-bottom:18px;">Generado el ${escapeHtml(data.fechaGeneracion)}</div>

  ${sectionTitle("Rentabilidad", color)}
  <div class="kpi-row">
    ${kpiBox("Ganancia Bruta", fmt(data.gananciaBruta), "#059669", "Ventas − Costos")}
    ${kpiBox("Gastos Totales", fmt(data.gastos), "#ef4444", "Egresos del período")}
    ${kpiBox("Ganancia Neta", fmt(data.utilidadNeta), color, "Bruta − Gastos")}
    ${kpiBox("Ingresos en Caja", fmt(data.ingresosCaja), "#7c3aed", `${fmtN(data.cantidadPagos)} transacciones`)}
  </div>
  <div class="kpi-row" style="margin-top:10px;">
    ${kpiBox("Por Consignación", fmt(data.gananciaConsignacion), "#0ea5e9", `${pctConsig}% de bruta`)}
    ${kpiBox("Ventas Directas", fmt(data.gananciaDirecta), "#d97706", `${pctDirecta}% de bruta`)}
    ${kpiBox("Ventas Registradas", fmtN(data.cantidadVentas), color, "Operaciones en el período")}
  </div>

  ${sectionTitle("Canal Digital", color)}
  <div class="kpi-row">
    ${kpiBox("Visitas de Catalogo", fmtN(data.catalogoVisitas), "#2563eb", "Catalogo publico")}
    ${kpiBox("Visitantes Unicos", fmtN(data.catalogoVisitantesUnicos), "#0ea5e9", "Estimado deduplicado")}
  </div>

  ${data.gastosDetalle.length > 0 ? `
  ${sectionTitle("Detalle de Gastos", "#ef4444")}
  <table>
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Concepto</th>
        <th>Categoría</th>
        <th style="text-align:center;">Tipo</th>
        <th class="right">Monto</th>
      </tr>
    </thead>
    <tbody>
      ${data.gastosDetalle.map((g) => `
      <tr>
        <td style="padding:5px 8px; font-size:11px; border-bottom:1px solid #f3f4f6; white-space:nowrap;">${escapeHtml(g.fecha)}</td>
        <td style="padding:5px 8px; font-size:11px; border-bottom:1px solid #f3f4f6;">${escapeHtml(g.motivo)}</td>
        <td style="padding:5px 8px; font-size:11px; border-bottom:1px solid #f3f4f6;">${escapeHtml(g.categoria)}</td>
        <td style="padding:5px 8px; font-size:10px; border-bottom:1px solid #f3f4f6; text-align:center;">
          <span style="background:${g.esCompartido ? "#fef3c7" : "#fee2e2"}; color:${g.esCompartido ? "#b45309" : "#dc2626"}; padding:2px 6px; border-radius:4px; font-weight:700; font-size:9px; text-transform:uppercase;">
            ${g.esCompartido ? "Compartido" : "Propio"}
          </span>
        </td>
        <td style="padding:5px 8px; font-size:11px; border-bottom:1px solid #f3f4f6; text-align:right; font-weight:700; color:#ef4444;">${escapeHtml(fmt(g.monto))}</td>
      </tr>`).join("")}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4" style="padding:6px 8px; font-size:11px; font-weight:700; text-align:right; border-top:2px solid #e5e7eb;">Total Gastos:</td>
        <td style="padding:6px 8px; font-size:12px; font-weight:800; text-align:right; border-top:2px solid #e5e7eb; color:#ef4444;">${escapeHtml(fmt(data.gastos))}</td>
      </tr>
    </tfoot>
  </table>
  ` : ""}

  ${sectionTitle("Stock", color)}
  <div class="kpi-row">
    ${kpiBox("Stock Disponible", fmtN(data.stockDisponible) + " u.", "#0ea5e9", "En depósito")}
    ${kpiBox("Stock en Calle", fmtN(data.stockConsignado) + " u.", "#f59e0b", "Consignado a clientes")}
  </div>

  ${sectionTitle("Consignaciones", color)}
  <div class="kpi-row">
    ${kpiBox("Abiertas", fmtN(data.consignacionesAbiertas), "#10b981", "Activas")}
    ${kpiBox("Cerradas", fmtN(data.consignacionesCerradas), "#6b7280", "Históricas")}
    ${kpiBox("Unidades Pendientes", fmtN(data.unitsPendientes) + " u.", "#ef4444", "Sin liquidar")}
  </div>

  ${data.tendencia.length > 0 ? `
  ${sectionTitle("Tendencia Diaria", color)}
  <table>
    <thead>
      <tr>
        <th>Fecha</th>
        <th class="right">Ventas ($)</th>
        <th class="right">Cobros ($)</th>
      </tr>
    </thead>
    <tbody>${tendenciaRows}</tbody>
  </table>
  ` : ""}

  ${brandingFooterHtml(branding)}
</body>
</html>`;
}
