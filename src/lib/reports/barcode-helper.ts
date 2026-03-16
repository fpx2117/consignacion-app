import * as bwipjs from 'bwip-js';

/**
 * Genera un código de barras CODE128 como data URL (PNG base64).
 * Funciona server-side sin DOM.
 * Retorna string vacío si el código es inválido o falla.
 */
export async function generateBarcodeDataUrl(
  code: string,
  options?: { height?: number; scale?: number }
): Promise<string> {
  if (!code || code.trim() === '') return '';

  try {
    const png = await bwipjs.toBuffer({
      bcid: 'code128',
      text: code.trim(),
      scale: options?.scale ?? 2,
      height: options?.height ?? 10,
      includetext: true,
      textxalign: 'center',
      textsize: 8,
      backgroundcolor: 'FFFFFF',
      barcolor: '0F172A',
    });

    return `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    return '';
  }
}

/**
 * Genera HTML de código de barras listo para insertar en template.
 * Retorna string vacío si falla (para no romper el reporte).
 */
export async function generateBarcodeHtml(
  code: string,
  options?: { height?: number; label?: string }
): Promise<string> {
  if (!code || code.trim() === '') return '';

  try {
    const dataUrl = await generateBarcodeDataUrl(code, options);
    if (!dataUrl) return '';

    const label = options?.label ?? code;
    return `<div style="text-align:center">
      <img src="${dataUrl}" alt="Barcode ${label}" style="display:block;margin:0 auto;max-width:200px" />
    </div>`;
  } catch {
    return '';
  }
}
