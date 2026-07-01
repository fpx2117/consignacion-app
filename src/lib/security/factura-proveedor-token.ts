// src/lib/security/factura-proveedor-token.ts
// Token firmado de corta duración para que Modal.com pueda descargar el archivo de
// una factura sin credenciales de sesión. Mismo patrón que pdf-token.ts pero con
// secreto y TTL propios: este token da acceso a un documento de negocio (precios de
// compra), no a un reporte ya generado, y sólo debe vivir minutos, no días.

import { createHmac, timingSafeEqual } from "crypto";

const _SECRET = process.env.OCR_CALLBACK_SECRET;
if (!_SECRET) {
  throw new Error("FATAL: La variable de entorno OCR_CALLBACK_SECRET es obligatoria.");
}
const SECRET: string = _SECRET;

const DEFAULT_EXPIRATION_MS = 10 * 60 * 1000; // 10 minutos: alcanza para que Modal descargue el archivo

function sign(facturaId: number, expiresAt: number): string {
  const dataToSign = `factura-proveedor-archivo-${facturaId}-${expiresAt}`;
  return createHmac("sha256", SECRET).update(dataToSign).digest("hex");
}

export function generateFacturaArchivoToken(facturaId: number): string {
  const expiresAt = Date.now() + DEFAULT_EXPIRATION_MS;
  const signature = sign(facturaId, expiresAt);
  return `${expiresAt}.${signature}`;
}

export function verifyFacturaArchivoToken(facturaId: number, tokenString: string | null | undefined): boolean {
  if (!tokenString || !tokenString.includes(".")) return false;

  const [expiresAtStr, signature] = tokenString.split(".");
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt)) return false;

  if (Date.now() > expiresAt) return false; // vencido

  const expectedSignature = sign(facturaId, expiresAt);
  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const actualBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== actualBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, actualBuffer);
}
