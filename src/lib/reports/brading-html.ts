import type { BrandingDTO } from "./get-branding";

/**
 * Header HTML reutilizable para todos los reportes.
 * Incluye logo opcional, nombre, y línea secundaria con address/phone.
 */
export function brandingHeaderHtml(b: BrandingDTO) {
  const metaLine = [b.address, b.phone]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map(escapeHtml)
    .join(" · ");

  const color = safeCssColor(b.primaryColor, "#111827");

  // ✅ Por seguridad/consistencia con Puppeteer: logoUrl debe ser absoluta (http/https)
  const logo =
    typeof b.logoUrl === "string" && isAbsoluteHttpUrl(b.logoUrl)
      ? `<img src="${escapeAttr(b.logoUrl)}" style="height:48px; object-fit:contain;" />`
      : "";

  return `
  <div style="display:flex; align-items:center; gap:12px; padding-bottom:10px; border-bottom:1px solid #e5e7eb;">
    ${logo}
    <div>
      <div style="font-size:18px; font-weight:700; color:${color}; line-height:1.1;">
        ${escapeHtml(b.businessName)}
      </div>
      ${metaLine ? `<div style="font-size:12px; color:#6b7280;">${metaLine}</div>` : ""}
    </div>
  </div>
  `;
}

/**
 * Footer HTML reutilizable para todos los reportes.
 */
export function brandingFooterHtml(b: BrandingDTO) {
  const txt =
    typeof b.footerText === "string" && b.footerText.trim().length > 0 ? b.footerText.trim() : "";

  if (!txt) return "";

  return `
    <div style="margin-top:14px; font-size:11px; color:#6b7280;">
      ${escapeHtml(txt)}
    </div>
  `;
}

/**
 * Escapa HTML (texto dentro de tags).
 */
function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Escapa atributos HTML (src, style values, etc.).
 * Reutiliza escapeHtml y además elimina saltos de línea.
 */
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/[\r\n]+/g, " ").trim();
}

/**
 * Permite solo colores CSS razonables (hex, rgb/rgba, hsl/hsla).
 * Si no matchea, usa fallback.
 */
function safeCssColor(input: unknown, fallback: string) {
  if (typeof input !== "string") return fallback;
  const v = input.trim();

  const hex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
  const rgb = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(\s*,\s*(0|1|0?\.\d+))?\s*\)$/;
  const hsl = /^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(\s*,\s*(0|1|0?\.\d+))?\s*\)$/;

  if (hex.test(v) || rgb.test(v) || hsl.test(v)) return v;
  return fallback;
}

/**
 * Chequea URL absoluta http(s)
 */
function isAbsoluteHttpUrl(url: string) {
  return /^https?:\/\/.+/i.test(url);
}
