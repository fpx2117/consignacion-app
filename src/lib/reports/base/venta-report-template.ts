import { reportThemeCss } from "@/lib/reports/report-theme";
import { getReportHeadAssets } from "@/lib/reports/tailwind-inline";
import {
  brandInitials,
  escapeAttr,
  escapeHtml,
  formatDateAR,
  formatMoneyARS,
  resolveReportTimezone,
} from "@/lib/reports/template-helpers";
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
  zonaHoraria: string;
  catalogUrl?: string;
  items: Array<{
    producto: string;
    cantidad: number;
    precioUnitario: number;
    descuento: number;
    subtotal: number;
  }>;
}

const getTicketDetails = (id: number, numeroVenta?: number | null) => {
  const numberToUse =
    typeof numeroVenta === "number" && numeroVenta > 0 ? numeroVenta : id;
  const LIMITE_POR_SERIE = 1000;
  const serie = Math.floor((numberToUse - 1) / LIMITE_POR_SERIE) + 1;
  const numero = ((numberToUse - 1) % LIMITE_POR_SERIE) + 1;
  return {
    serie: String(serie).padStart(2, "0"),
    numero: String(numero).padStart(4, "0"),
  };
};

function getMetodoPagoLabel(metodo: string): string {
  const m = metodo.toUpperCase();
  if (m === "EFECTIVO") return "Efectivo";
  if (m === "TARJETA") return "Tarjeta";
  if (m === "TRANSFERENCIA") return "Transferencia";
  return metodo;
}

function buildVentaBody(
  data: VentaReportDTO,
  branding: BrandingDTO,
  qrHtml: string,
): string {
  const ticket = getTicketDetails(data.id, data.numeroVenta);
  const tz = resolveReportTimezone(data.zonaHoraria);

  const primary = branding.primaryColor ?? "#4f46e5";
  const brandName = branding.businessName || "Negocio";
  const brandBadge = brandInitials(brandName);
  const footerText = branding.footerText ? escapeHtml(branding.footerText) : "";
  const metaLine = [branding.address, branding.phone]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((x) => escapeHtml(x))
    .join("&nbsp;&middot;&nbsp;");

  const metodoPago = getMetodoPagoLabel(data.metodoPago);
  const hasDescuentoGlobal = (data.descuentoGlobal ?? 0) > 0;
  const subtotalBruto = data.items.reduce(
    (a, i) => a + i.precioUnitario * i.cantidad,
    0,
  );
  const totalDescuentoItems = data.items.reduce((a, i) => a + i.descuento, 0);

  const itemRows = data.items
    .map((item, idx) => {
      const bg = idx % 2 === 0 ? "#f8fafc" : "#ffffff";
      const hasDesc = item.descuento > 0;
      return `
      <tr style="background:${bg}">
        <td style="padding:7px 8px 7px 12px;font-weight:600;color:#1e293b;font-size:11px;max-width:200px;word-break:break-word">${escapeHtml(item.producto)}</td>
        <td style="padding:7px 8px;text-align:center;font-weight:700;color:#475569;font-size:11px">${item.cantidad}</td>
        <td style="padding:7px 8px;text-align:right;color:#64748b;font-size:11px;white-space:nowrap">${formatMoneyARS(item.precioUnitario)}</td>
        <td style="padding:7px 8px;text-align:right;font-weight:700;font-size:11px;white-space:nowrap;color:${hasDesc ? "#059669" : "#cbd5e1"}">${hasDesc ? `-${formatMoneyARS(item.descuento)}` : "—"}</td>
        <td style="padding:7px 12px 7px 8px;text-align:right;font-weight:800;font-size:11px;white-space:nowrap;color:#0f172a">${formatMoneyARS(item.subtotal)}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  ${getReportHeadAssets(`
    ${reportThemeCss(primary)}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4; margin: 12mm 12mm 10mm 12mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .money { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
  `)}
</head>
<body>

  <!-- ══ HEADER ══════════════════════════════════════════════════ -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:2px solid #e2e8f0;margin-bottom:14px">

    <!-- Logo + nombre -->
    <div style="display:flex;align-items:center;gap:12px">
      ${
        branding.logoBase64
          ? `<img src="${escapeAttr(branding.logoBase64)}" style="width:44px;height:44px;border-radius:10px;object-fit:contain;border:1px solid #e2e8f0"/>`
          : `<div style="width:44px;height:44px;background:#0f172a;color:#fff;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px">${escapeHtml(brandBadge)}</div>`
      }
      <div>
        <div style="font-size:17px;font-weight:900;color:#0f172a;letter-spacing:-0.3px">${escapeHtml(brandName)}</div>
        <div style="font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;margin-top:1px">Ticket de Venta</div>
        ${metaLine ? `<div style="font-size:9px;color:#94a3b8;margin-top:3px">${metaLine}</div>` : ""}
      </div>
    </div>

    <!-- Número de ticket -->
    <div style="text-align:right">
      <div style="font-size:8px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:2px">N° de Ticket</div>
      <div style="font-size:9px;font-weight:700;color:#94a3b8;background:#f1f5f9;display:inline-block;padding:1px 7px;border-radius:4px;margin-bottom:3px">SERIE ${ticket.serie}</div>
      <div style="font-size:32px;font-weight:900;color:#0f172a;line-height:1;letter-spacing:-1px">#${ticket.numero}</div>
      <div style="font-size:9px;color:#64748b;margin-top:4px">${formatDateAR(data.fecha, true, tz)}</div>
    </div>
  </div>

  <!-- ══ CLIENTE + TOTAL ════════════════════════════════════════ -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">

    <!-- Cliente -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px">
      <div style="font-size:8px;font-weight:900;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:5px">Cliente</div>
      <div style="font-size:14px;font-weight:900;color:#1e293b;letter-spacing:-0.2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(data.clienteNombre)}</div>
      ${data.clienteTelefono ? `<div style="font-size:10px;color:#64748b;margin-top:3px">${escapeHtml(data.clienteTelefono)}</div>` : ""}
    </div>

    <!-- Total -->
    <div style="background:${primary};border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;justify-content:center;align-items:flex-end;position:relative;overflow:hidden">
      <div style="font-size:8px;font-weight:900;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px;position:relative;z-index:1">Total Abonado</div>
      <div class="money" style="font-size:28px;font-weight:900;color:#fff;letter-spacing:-1px;line-height:1;position:relative;z-index:1">${formatMoneyARS(data.total)}</div>
      <div style="margin-top:8px;padding-top:7px;border-top:1px solid rgba(255,255,255,0.2);display:flex;align-items:center;gap:6px;position:relative;z-index:1">
        <span style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase">Pago:</span>
        <span style="font-size:10px;font-weight:800;color:#fff;background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:6px">${escapeHtml(metodoPago)}</span>
      </div>
      <div style="position:absolute;bottom:-10px;left:-10px;width:60px;height:60px;background:rgba(255,255,255,0.08);border-radius:50%"></div>
    </div>
  </div>

  <!-- ══ TABLA DE ÍTEMS ══════════════════════════════════════════ -->
  <div style="margin-bottom:12px">
    <div style="font-size:9px;font-weight:900;color:#0f172a;text-transform:uppercase;letter-spacing:1.5px;display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <span style="flex:none;width:20px;height:1px;background:#e2e8f0"></span>
      Detalle de Items
      <span style="flex:1;height:1px;background:#e2e8f0"></span>
    </div>

    <table style="width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden">
      <thead>
        <tr style="background:#f1f5f9">
          <th style="padding:7px 8px 7px 12px;text-align:left;font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:1px">Producto</th>
          <th style="padding:7px 8px;text-align:center;font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:1px">Cant.</th>
          <th style="padding:7px 8px;text-align:right;font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:1px">P. Unit.</th>
          <th style="padding:7px 8px;text-align:right;font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:1px">Desc.</th>
          <th style="padding:7px 12px 7px 8px;text-align:right;font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:1px">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
        ${
          totalDescuentoItems > 0
            ? `
        <tr style="background:#f0fdf4">
          <td colspan="3" style="padding:7px 8px 7px 12px;font-size:10px;font-weight:700;color:#059669">Descuentos aplicados</td>
          <td colspan="2" style="padding:7px 12px 7px 8px;text-align:right;font-size:11px;font-weight:900;color:#059669" class="money">-${formatMoneyARS(totalDescuentoItems)}</td>
        </tr>`
            : ""
        }
        ${
          hasDescuentoGlobal
            ? `
        <tr style="background:#f0fdf4">
          <td colspan="3" style="padding:7px 8px 7px 12px;font-size:10px;font-weight:700;color:#059669">Descuento general</td>
          <td colspan="2" style="padding:7px 12px 7px 8px;text-align:right;font-size:11px;font-weight:900;color:#059669" class="money">-${formatMoneyARS(data.descuentoGlobal!)}</td>
        </tr>`
            : ""
        }
      </tbody>
    </table>

    <!-- Totales resumen -->
    <div style="margin-top:8px;display:flex;flex-direction:column;align-items:flex-end;gap:3px">
      ${
        subtotalBruto !== data.total
          ? `
      <div style="display:flex;gap:24px;font-size:10px;color:#64748b">
        <span>Subtotal</span>
        <span class="money" style="font-weight:600">${formatMoneyARS(subtotalBruto)}</span>
      </div>`
          : ""
      }
      ${
        totalDescuentoItems > 0
          ? `
      <div style="display:flex;gap:24px;font-size:10px;color:#059669">
        <span>Descuentos</span>
        <span class="money" style="font-weight:700">-${formatMoneyARS(totalDescuentoItems)}</span>
      </div>`
          : ""
      }
      ${
        hasDescuentoGlobal
          ? `
      <div style="display:flex;gap:24px;font-size:10px;color:#059669">
        <span>Dto. general</span>
        <span class="money" style="font-weight:700">-${formatMoneyARS(data.descuentoGlobal!)}</span>
      </div>`
          : ""
      }
      <div style="display:flex;gap:24px;padding-top:6px;border-top:2px solid #e2e8f0;margin-top:2px">
        <span style="font-size:12px;font-weight:900;color:#0f172a">TOTAL</span>
        <span class="money" style="font-size:16px;font-weight:900;color:#0f172a">${formatMoneyARS(data.total)}</span>
      </div>
    </div>
  </div>

  <!-- ══ FOOTER ═════════════════════════════════════════════════ -->
  <div style="border-top:1px solid #e2e8f0;padding-top:10px;display:flex;justify-content:space-between;align-items:center">
    ${
      qrHtml
        ? `
    <div style="display:flex;align-items:center;gap:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px">
      ${qrHtml}
      <div>
        <div style="font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:2px">Catálogo online</div>
        <div style="font-size:8px;color:#64748b;line-height:1.5">Escaneá para ver<br>todos nuestros productos</div>
      </div>
    </div>`
        : `<div></div>`
    }
    <div style="text-align:right">
      <div style="font-size:10px;font-weight:600;color:#94a3b8">Gracias por su compra</div>
      ${footerText ? `<div style="font-size:9px;color:#94a3b8;margin-top:2px">${footerText}</div>` : ""}
    </div>
  </div>

</body>
</html>`;
}

export async function buildVentaHtmlAsync(
  data: VentaReportDTO,
  branding: BrandingDTO,
): Promise<string> {
  let qrHtml = "";
  if (data.catalogUrl) {
    qrHtml = await generateQRHtml(data.catalogUrl, {
      size: 60,
      darkColor: "#0f172a",
    });
  }
  return buildVentaBody(data, branding, qrHtml);
}

export function buildVentaHtml(
  data: VentaReportDTO,
  branding: BrandingDTO,
): string {
  return buildVentaBody(data, branding, "");
}
