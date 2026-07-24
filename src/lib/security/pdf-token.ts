import { createHmac } from "crypto";

const _PDF_SECRET = process.env.SHARE_LINK_SECRET || process.env.PDF_SECRET;
if (!_PDF_SECRET) {
  throw new Error(
    "FATAL: La variable de entorno SHARE_LINK_SECRET (o PDF_SECRET) es obligatoria.",
  );
}
const PDF_SECRET: string = _PDF_SECRET;

// Duración por defecto: 7 días (en milisegundos)
const DEFAULT_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;

export function generatePdfToken(id: number): string {
  // 1. Calculamos cuándo vence (Ahora + 7 días)
  const expiresAt = Date.now() + DEFAULT_EXPIRATION_MS;

  // 2. Creamos la firma usando el ID y la FECHA de vencimiento
  // Esto evita que alguien cambie la fecha manualmente en la URL
  const dataToSign = `consignacion-${id}-${expiresAt}`;

  const signature = createHmac("sha256", PDF_SECRET)
    .update(dataToSign)
    .digest("hex")
    .substring(0, 16);

  // 3. El token final es: "FECHA.FIRMA"
  // Necesitamos enviar la fecha en el token para poder validarla después
  return `${expiresAt}.${signature}`;
}

export function verifyPdfToken(id: number, tokenString: string): boolean {
  if (!tokenString || !tokenString.includes(".")) return false;

  const [expiresAtStr, signature] = tokenString.split(".");
  const expiresAt = parseInt(expiresAtStr);

  // 1. Chequeo de tiempo: ¿Ya pasó la fecha?
  if (Date.now() > expiresAt) {
    return false; // Token vencido
  }

  // 2. Chequeo de firma: ¿Es legítimo este timestamp para este ID?
  // Reconstruimos la firma esperada con los mismos datos
  const expectedData = `consignacion-${id}-${expiresAt}`;

  const expectedSignature = createHmac("sha256", PDF_SECRET)
    .update(expectedData)
    .digest("hex")
    .substring(0, 16);

  return signature === expectedSignature;
}
