import QRCode from 'qrcode';

/**
 * Genera un QR como data URL (PNG base64) listo para usar en <img src="...">
 * Funciona server-side sin DOM.
 */
export async function generateQRDataUrl(
  data: string,
  options?: { size?: number; darkColor?: string; lightColor?: string }
): Promise<string> {
  const size = options?.size ?? 100;
  const dark = options?.darkColor ?? '#0F172A';
  const light = options?.lightColor ?? '#FFFFFF';

  return QRCode.toDataURL(data, {
    width: size,
    margin: 1,
    color: { dark, light },
    errorCorrectionLevel: 'M',
  });
}

/**
 * Genera HTML de imagen QR lista para insertar en template.
 * Retorna string vacío si falla (para no romper el reporte).
 */
export async function generateQRHtml(
  data: string,
  options?: { size?: number; darkColor?: string; label?: string }
): Promise<string> {
  try {
    const dataUrl = await generateQRDataUrl(data, options);
    const size = options?.size ?? 100;
    const label = options?.label ?? '';
    return `<div style="text-align:center">
      <img src="${dataUrl}" width="${size}" height="${size}" alt="QR" style="display:block;margin:0 auto" />
      ${label ? `<span style="font-size:9px;color:#64748b;margin-top:4px;display:block">${label}</span>` : ''}
    </div>`;
  } catch {
    return '';
  }
}
