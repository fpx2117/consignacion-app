// src/lib/ocr/extraer-texto-factura.ts
// Extracción de texto "barata" (CPU, sin GPU/vision) de una factura ya subida.
// Centraliza la lógica que antes vivía duplicada en la ruta OCR vieja
// (productos/ocr-factura/analizar, ahora eliminada): PDF nativo se lee directo,
// PDF escaneado o imagen pasan por Tesseract local. El resultado es texto plano
// que alimenta al extractor IA (OpenRouter) — nunca se manda la imagen/PDF en sí.

import {
  esPdf,
  esImagenSoportada,
  extraerTextoPdf,
  rasterizarPdf,
  preprocesarImagen,
} from "./ocr-engine";
import { recognizeImage } from "./tesseract-service";

export type TextoFacturaExtraido = {
  texto: string;
  confianzaOcr: number;
};

export class FormatoFacturaNoSoportadoError extends Error {}

export async function extraerTextoFactura(input: {
  buffer: Buffer;
  mimeType: string;
}): Promise<TextoFacturaExtraido> {
  const { buffer, mimeType } = input;

  if (esPdf(mimeType)) {
    const textoNativo = await extraerTextoPdf(buffer);
    if (textoNativo) {
      return { texto: textoNativo, confianzaOcr: 100 };
    }

    const imagenParaOcr = await rasterizarPdf(buffer);
    const preprocesada = await preprocesarImagen(imagenParaOcr);
    const resultado = await recognizeImage(preprocesada);
    return { texto: resultado.texto, confianzaOcr: resultado.confianza };
  }

  if (esImagenSoportada(mimeType)) {
    const preprocesada = await preprocesarImagen(buffer);
    const resultado = await recognizeImage(preprocesada);
    return { texto: resultado.texto, confianzaOcr: resultado.confianza };
  }

  throw new FormatoFacturaNoSoportadoError(`Tipo de archivo no soportado para OCR: ${mimeType}`);
}
