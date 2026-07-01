// src/lib/ocr/ocr-engine.ts
// Motor de OCR reutilizable con soporte para Railway.
//
// Estrategia de rasterizado de PDFs (de la más liviana a la más pesada):
//   1. PDF nativo texto → pdf-parse (sin Chromium, casi cero overhead)
//   2. PDF escaneado/imagen → Puppeteer + Chromium (solo como fallback)
//
// Para imágenes (JPG/PNG/WEBP) → Tesseract.js directo (sin Chromium).
// Esto evita el 502 en Railway para el 90% de los casos de uso.
//
// En Railway, Chromium se lanza vía @sparticuz/chromium (ver
// src/lib/chromium/resolve-executable-path.ts) en vez de depender de un
// binario instalado en el sistema.

import path from "path";
import { writeFile, rm } from "fs/promises";
import os from "os";
import crypto from "crypto";
import sharp from "sharp";
import { launchOcrBrowser } from "@/lib/chromium/resolve-executable-path";

const IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/bmp",
] as const;

// ─── Helpers de tipo MIME ────────────────────────────────────────────

export function esImagenSoportada(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.includes(mimeType as typeof IMAGE_MIME_TYPES[number]);
}

export function esPdf(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

// ─── Preprocesamiento de imagen (sharp) ──────────────────────────────

// Tesseract rinde notablemente peor con texto chico/borroso — típico en fotos
// de celular sacadas a distancia. Si la imagen viene angosta, se escala hacia
// arriba antes de OCR (equivalente a acercarse más a la factura).
const ANCHO_MINIMO_OCR = 1800;

/** Preprocesa la imagen (escala de grises + normalizado + nitidez) para mejorar el reconocimiento. */
export async function preprocesarImagen(buffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(buffer).metadata();
  const anchoActual = metadata.width ?? 0;

  let pipeline = sharp(buffer)
    .rotate() // respeta orientación EXIF (fotos de celular)
    .grayscale();

  if (anchoActual > 0 && anchoActual < ANCHO_MINIMO_OCR) {
    pipeline = pipeline.resize({ width: ANCHO_MINIMO_OCR, kernel: "lanczos3" });
  }

  return pipeline
    .normalize()
    .sharpen()
    .toFormat("png")
    .toBuffer();
}

// Ancho máximo para el fallback de visión (OCR + IA, ver invoice-ai-parser.ts):
// a diferencia de preprocesarImagen() (arriba, pensado para Tesseract), acá se
// mantiene el color y no se fuerza contraste/nitidez — un modelo de visión
// rinde mejor con la imagen tal cual la sacó el usuario. Solo se achica para
// no mandar un archivo de varios MB y disparar el costo en tokens de imagen.
const ANCHO_MAXIMO_VISION = 1600;

/** Copia liviana a color de la imagen, pensada para mandar a un modelo de visión (no a Tesseract). */
export async function prepararImagenParaVision(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize({ width: ANCHO_MAXIMO_VISION, withoutEnlargement: true, kernel: "lanczos3" })
    .toFormat("jpeg", { quality: 80 })
    .toBuffer();
}

// ─── Rasterizado de PDF (Puppeteer + Chromium) ───────────────────────
// Solo se usa como fallback para PDFs escaneados sin texto nativo.

export async function rasterizarPdf(buffer: Buffer, maxPaginas = 5): Promise<Buffer> {
  console.log("[OCR] Rasterizando PDF con Chromium...");
  const tempPath = path.join(os.tmpdir(), `ocr-factura-${crypto.randomUUID()}.pdf`);
  await writeFile(tempPath, buffer);

  const browser = await launchOcrBrowser();
  try {
    const page = await browser.newPage();
    const altoMaximo = 1600 * maxPaginas;
    await page.setViewport({ width: 1240, height: Math.min(altoMaximo, 8000) });
    // #toolbar=0 oculta la barra de herramientas del visor de PDF nativo de Chromium,
    // que de otro modo queda "impresa" en la captura y ensucia el OCR.
    await page.goto(`file://${tempPath.replace(/\\/g, "/")}#toolbar=0`, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });
    // Da tiempo al visor de PDF embebido de Chromium a terminar de renderizar.
    await new Promise((resolve) => setTimeout(resolve, 800));

    const screenshot = await page.screenshot({ type: "png", fullPage: true });
    return Buffer.from(screenshot);
  } finally {
    await browser.close().catch(() => {});
    await rm(tempPath, { force: true });
  }
}

// ─── Extracción de texto nativo de PDF (pdf-parse) ───────────────────
// Alternativa liviana: sin Chromium, solo extrae texto ya presente en el PDF.
// Útil para facturas electrónicas / PDFs generados por sistema.

export async function extraerTextoPdf(buffer: Buffer): Promise<string | null> {
  try {
    // pdf-parse v2.x exporta la clase PDFParse (no default export)
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    const text = result.text?.trim();
    if (text && text.length > 20) {
      console.log("[OCR] PDF nativo: texto extraído sin Chromium");
      return text;
    }
    return null;
  } catch (error) {
    console.warn("[OCR] pdf-parse falló, se usará Chromium como fallback:", error);
    return null;
  }
}
