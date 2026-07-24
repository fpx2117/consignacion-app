// src/lib/reports/base/dashboard-report-template.ts
import { REPORT_COLORS, reportThemeCss } from "@/lib/reports/report-theme";
import {
  escapeHtml,
  formatMoneyARS,
  formatNumberAR,
} from "@/lib/reports/template-helpers";
import { getReportHeadAssets } from "@/lib/reports/tailwind-inline";
import type { BrandingDTO } from "@/lib/reports/types";
import {
  brandingHeaderHtml,
  brandingFooterHtml,
} from "@/lib/reports/branding-html";

export type DashboardReportData = {
  period: string;
  periodLabel: string;
  fechaGeneracion: string;

  // Finanzas
  gananciaBruta: number;
  gananciaNeta: number;
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
  catalogoProductosVisibles?: number;

  // Stock
  stockDisponible: number;
  stockConsignado: number;

  // Consignaciones
  consignacionesAbiertas: number;
  consignacionesCerradas: number;
  unitsPendientes: number;

  // Tendencia (optional, can be empty array for "all" period)
  tendencia: { date: string; ventasTotal: number; pagosTotal: number }[];

  // Finanzas adicionales
  saldoGlobal?: number;

  // Gastos detallados
  gastosDetalle: {
    motivo: string;
    categoria: string;
    monto: number;
    fecha: string;
    esCompartido: boolean;
  }[];
};

const fmt = (n: number) => formatMoneyARS(n, 2);
const fmtN = (n: number) => formatNumberAR(n);

function statusBadge(label: string, bg: string, text: string): string {
  return `<span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:9px;font-weight:700;background:${bg};color:${text};margin-left:6px;vertical-align:middle;">${label}</span>`;
}

function kpiBox(
  label: string,
  value: string,
  accent: string,
  sub?: string,
  badge?: string,
  formula?: string,
): string {
  return `
    <div style="background:${REPORT_COLORS.surface}; border:1px solid ${REPORT_COLORS.line}; border-radius:10px; padding:14px 16px; min-width:140px; flex:1;">
      <div style="font-size:10px; font-weight:700; color:${accent}; text-transform:uppercase; letter-spacing:.06em; margin-bottom:4px;">${escapeHtml(label)}</div>
      <div style="font-size:20px; font-weight:800; color:${REPORT_COLORS.text}; line-height:1.1;">${escapeHtml(value)}${badge ?? ""}</div>
      ${sub ? `<div style="font-size:10px; color:${REPORT_COLORS.textMuted}; margin-top:3px;">${escapeHtml(sub)}</div>` : ""}
      ${formula ? `<div style="font-size:9px; color:${REPORT_COLORS.textSubtle}; margin-top:2px; font-family:monospace;">${escapeHtml(formula)}</div>` : ""}
    </div>`;
}

function sectionTitle(title: string, color: string): string {
  return `<h2 style="font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:${color}; border-bottom:2px solid ${color}20; padding-bottom:6px; margin:22px 0 12px;">${escapeHtml(title)}</h2>`;
}

export function buildDashboardReportHtml(
  data: DashboardReportData,
  branding: BrandingDTO,
): string {
  const color = branding.primaryColor || REPORT_COLORS.brandDefault;

  const pctConsig =
    data.gananciaBruta > 0
      ? Math.round((data.gananciaConsignacion / data.gananciaBruta) * 100)
      : 0;
  const pctDirecta =
    data.gananciaBruta > 0
      ? Math.round((data.gananciaDirecta / data.gananciaBruta) * 100)
      : 0;

  // --- Badges de estado ---
  const utilidadBadge =
    data.utilidadNeta > 0
      ? statusBadge("POSITIVO", "#d1fae5", "#059669")
      : statusBadge("NEGATIVO", "#ffe4e6", "#E11D48");
  const gastosBadge =
    data.gastos > data.gananciaBruta * 0.3
      ? statusBadge("ALTO", "#fef3c7", "#D97706")
      : statusBadge("NORMAL", "#d1fae5", "#059669");

  const tendenciaRows =
    data.tendencia.length > 0
      ? data.tendencia
          .map(
            (p) => `
        <tr>
          <td style="padding:5px 8px; font-size:11px; border-bottom:1px solid ${REPORT_COLORS.lineSoft};">${escapeHtml(p.date)}</td>
          <td style="padding:5px 8px; font-size:11px; border-bottom:1px solid ${REPORT_COLORS.lineSoft}; text-align:right;">${fmt(p.ventasTotal)}</td>
          <td style="padding:5px 8px; font-size:11px; border-bottom:1px solid ${REPORT_COLORS.lineSoft}; text-align:right;">${fmt(p.pagosTotal)}</td>
        </tr>`,
          )
          .join("")
      : `<tr><td colspan="3" style="text-align:center; color:${REPORT_COLORS.textSubtle}; font-size:11px; padding:12px;">Sin datos de tendencia para el período histórico.</td></tr>`;

  const dashboardExtraCss = `
    ${reportThemeCss(color)}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background:${REPORT_COLORS.paper}; color:${REPORT_COLORS.text}; padding:20px 24px; font-size:13px; }
    .kpi-row { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:6px; }
    table { width:100%; border-collapse:collapse; }
    th { background:${color}15; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:${color}; padding:6px 8px; border-bottom:2px solid ${color}30; text-align:left; }
    th.right { text-align:right; }
    .tag { display:inline-block; padding:2px 8px; border-radius:99px; font-size:10px; font-weight:700; }
    .badge-period { background:${color}18; color:${color}; padding:3px 10px; border-radius:6px; font-size:10px; font-weight:700; margin-left:8px; vertical-align:middle; }
    /* Evitar que las secciones se corten entre páginas */
    .no-break { break-inside: avoid; page-break-inside: avoid; -webkit-column-break-inside: avoid; }
    .no-break table tbody tr { break-inside: avoid; page-break-inside: avoid; }
    `;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  ${getReportHeadAssets(dashboardExtraCss)}
</head>
<body>
  ${brandingHeaderHtml(branding)}

  <div style="margin:14px 0 18px; display:flex; align-items:center; flex-wrap:wrap; gap:8px;">
    <div style="font-size:20px; font-weight:900; color:${REPORT_COLORS.text}; letter-spacing:-.02em;">Reporte de Dashboard</div>
    <span class="badge-period">${escapeHtml(data.periodLabel)}</span>
  </div>
  <div style="font-size:10px; color:${REPORT_COLORS.textSubtle}; margin-bottom:18px;">Generado el ${escapeHtml(data.fechaGeneracion)}</div>

  ${sectionTitle("Rentabilidad", color)}
  <div class="no-break">
    <div class="kpi-row">
      ${kpiBox("Ganancia Bruta", fmt(data.gananciaBruta), REPORT_COLORS.success, "Utilidad de ventas", undefined, "Σ(Subtotal − Costo×U) − Desc.Global")}
      ${kpiBox("Ganancia Neta", fmt(data.gananciaNeta), REPORT_COLORS.info, "Sin restar gastos", undefined, "Bruta − Roturas")}
      ${kpiBox("Gastos Totales", fmt(data.gastos), REPORT_COLORS.danger, "Egresos del período", gastosBadge, "Propios + Compartidos(proporción)")}
      ${kpiBox("Utilidad Neta", fmt(data.utilidadNeta), color, "Resultado final", utilidadBadge, "Bruta − Gastos − Roturas")}
    </div>
    <div class="kpi-row" style="margin-top:10px;">
      ${kpiBox("Por Consignación", fmt(data.gananciaConsignacion), REPORT_COLORS.info, `${pctConsig}% de bruta`)}
      ${kpiBox("Ventas Directas", fmt(data.gananciaDirecta), REPORT_COLORS.accentAmber, `${pctDirecta}% de bruta`)}
      ${kpiBox("Movimiento Total", fmt(data.ingresosCaja), REPORT_COLORS.accentViolet, `${fmtN(data.cantidadPagos)} transacciones`)}
      ${kpiBox("Ventas Registradas", fmtN(data.cantidadVentas), color, "Operaciones en el período")}
    </div>
  </div>

  ${sectionTitle("Canal Digital", color)}
  <div class="no-break">
    <div class="kpi-row">
      ${kpiBox("Visitas de Catalogo", fmtN(data.catalogoVisitas), REPORT_COLORS.accentBlue, "Catalogo publico")}
      ${kpiBox("Visitantes Unicos", fmtN(data.catalogoVisitantesUnicos), REPORT_COLORS.info, "Estimado deduplicado")}
      ${kpiBox("En Catalogo", fmtN(data.catalogoProductosVisibles ?? 0) + " prod.", REPORT_COLORS.successStrong, "Activos con stock")}
    </div>
  </div>

  ${
    data.gastosDetalle.length > 0
      ? `
  <div class="no-break">
    ${sectionTitle("Detalle de Gastos", REPORT_COLORS.danger)}
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
        ${data.gastosDetalle
          .map(
            (g) => `
        <tr>
          <td style="padding:5px 8px; font-size:11px; border-bottom:1px solid ${REPORT_COLORS.lineSoft}; white-space:nowrap;">${escapeHtml(g.fecha)}</td>
          <td style="padding:5px 8px; font-size:11px; border-bottom:1px solid ${REPORT_COLORS.lineSoft};">${escapeHtml(g.motivo)}</td>
          <td style="padding:5px 8px; font-size:11px; border-bottom:1px solid ${REPORT_COLORS.lineSoft};">${escapeHtml(g.categoria)}</td>
          <td style="padding:5px 8px; font-size:10px; border-bottom:1px solid ${REPORT_COLORS.lineSoft}; text-align:center;">
            <span style="background:${g.esCompartido ? REPORT_COLORS.sharedBg : REPORT_COLORS.ownBg}; color:${g.esCompartido ? REPORT_COLORS.sharedText : REPORT_COLORS.ownText}; padding:2px 6px; border-radius:4px; font-weight:700; font-size:9px; text-transform:uppercase;">
              ${g.esCompartido ? "Compartido" : "Propio"}
            </span>
          </td>
          <td style="padding:5px 8px; font-size:11px; border-bottom:1px solid ${REPORT_COLORS.lineSoft}; text-align:right; font-weight:700; color:${REPORT_COLORS.danger};">${escapeHtml(fmt(g.monto))}</td>
        </tr>`,
          )
          .join("")}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4" style="padding:6px 8px; font-size:11px; font-weight:700; text-align:right; border-top:2px solid ${REPORT_COLORS.line};">Total Gastos:</td>
          <td style="padding:6px 8px; font-size:12px; font-weight:800; text-align:right; border-top:2px solid ${REPORT_COLORS.line}; color:${REPORT_COLORS.danger};">${escapeHtml(fmt(data.gastos))}</td>
        </tr>
      </tfoot>
    </table>
  </div>
  `
      : ""
  }

  ${sectionTitle("Stock", color)}
  <div class="no-break">
    <div class="kpi-row">
      ${kpiBox("Stock Disponible", fmtN(data.stockDisponible) + " u.", REPORT_COLORS.info, "En depósito")}
      ${kpiBox("Stock en Calle", fmtN(data.stockConsignado) + " u.", REPORT_COLORS.warning, "Consignado a clientes")}
    </div>
  </div>

  ${sectionTitle("Consignaciones", color)}
  <div class="no-break">
    <div class="kpi-row">
      ${kpiBox("Abiertas", fmtN(data.consignacionesAbiertas), REPORT_COLORS.successStrong, "Activas")}
      ${kpiBox("Cerradas", fmtN(data.consignacionesCerradas), REPORT_COLORS.textMuted, "Históricas")}
      ${kpiBox("Unidades Pendientes", fmtN(data.unitsPendientes) + " u.", REPORT_COLORS.danger, "Sin liquidar")}
    </div>
  </div>

  ${sectionTitle("Finanzas Adicionales", color)}
  <div class="no-break">
    <div class="kpi-row">
      ${kpiBox("Saldo Global", fmt(data.saldoGlobal ?? 0), REPORT_COLORS.danger, "Deuda acumulada en clientes")}
    </div>
  </div>

  ${
    data.tendencia.length > 0
      ? `
  <div class="no-break">
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
  </div>
  `
      : ""
  }

  ${brandingFooterHtml(branding)}
</body>
</html>`;
}
