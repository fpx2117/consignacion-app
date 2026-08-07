// src/lib/ocr/mime-types.ts
// Helpers de tipo MIME sin dependencias pesadas (a diferencia de ocr-engine.ts,
// que importa sharp). El camino de OCR "visión directa" los usa sin pagar el
// costo de cargar librerías nativas.
//
// Mantenido en un módulo separado a propósito: invoice-ai-parser decide qué
// camino tomar según el mime, y ese módulo no debe arrastrar sharp/tesseract
// cuando no los necesita.

export const IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/bmp",
] as const;

export function esImagenSoportada(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.includes(
    mimeType as (typeof IMAGE_MIME_TYPES)[number],
  );
}

export function esPdf(mimeType: string): boolean {
  return mimeType === "application/pdf";
}
