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
import { withChromiumSlot } from "@/lib/chromium/chromium-semaphore";

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

// Fotos de celular de facturas con muchas líneas (15-20 items) suelen llegar
// angostas (ej. 739px) porque la cámara encuadra la hoja completa. Enviarlas
// tal cual a un modelo de visión, más un segundo JPEG con pérdida encima,
// borronea los trazos finos que distinguen letras parecidas (N/W/M, S/T) —
// confirmado con un caso real ("RASASI HAWAS" leído como "RASAST HAMAS"). Se
// agranda igual que en preprocesarImagen() para darle al modelo más píxeles
// por carácter antes de mandarla. Ojo: esto solo tiene sentido para fotos
// (compresión con pérdida + cámara chica); una captura de Chromium ya sale
// nítida (render vectorial), así que el caller de PDF rasterizado pasa
// permitirUpscale=false — agrandarla no suma legibilidad, solo tokens.
const ANCHO_MINIMO_VISION = 1600;

/** Copia a color de la imagen, pensada para mandar a un modelo de visión (no a Tesseract). */
export async function prepararImagenParaVision(
  buffer: Buffer,
  opciones: { permitirUpscale?: boolean } = {},
): Promise<Buffer> {
  const { permitirUpscale = true } = opciones;
  const metadata = await sharp(buffer).metadata();
  const anchoActual = metadata.width ?? 0;

  let pipeline = sharp(buffer).rotate();

  if (permitirUpscale && anchoActual > 0 && anchoActual < ANCHO_MINIMO_VISION) {
    pipeline = pipeline.resize({ width: ANCHO_MINIMO_VISION, kernel: "lanczos3" });
  } else if (anchoActual > ANCHO_MAXIMO_VISION) {
    pipeline = pipeline.resize({ width: ANCHO_MAXIMO_VISION, kernel: "lanczos3" });
  }

  // PNG (sin pérdida) en vez de re-comprimir como JPEG: la imagen ya viene
  // comprimida por la cámara/WhatsApp, sumarle una segunda compresión con
  // pérdida es justo lo que borroneaba los trazos finos. El archivo pesa más,
  // pero el costo de tokens de imagen en OpenRouter depende de resolución, no
  // de bytes, así que no impacta el costo por factura.
  return pipeline.toFormat("png").toBuffer();
}

// ─── Rasterizado de PDF (Puppeteer + Chromium) ───────────────────────
// Solo se usa como fallback para PDFs escaneados sin texto nativo.

// maxPaginas=3 (antes 5): esta captura se concatena en una sola imagen alta
// que se manda entera al modelo de visión (ver prepararImagenParaVision) — más
// páginas = más tiles = más costo en tokens, sin relación con la calidad de
// lectura. Un comprobante de proveedor de más de 2-3 páginas es poco común;
// bajar el techo acota el costo máximo por documento sin tocar la resolución
// por página (no sacrifica precisión, solo cuántas páginas entran en una
// factura excepcionalmente larga). Ver optimizacion-tokens-y-limite-costo.md.
export async function rasterizarPdf(buffer: Buffer, maxPaginas = 3): Promise<Buffer> {
  console.log("[OCR] Rasterizando PDF con Chromium...");
  const tempPath = path.join(os.tmpdir(), `ocr-factura-${crypto.randomUUID()}.pdf`);
  await writeFile(tempPath, buffer);

  try {
    // Comparte el mismo cupo de concurrencia que los reportes PDF (ver
    // chromium-semaphore.ts) — ambos consumen del mismo presupuesto de RAM
    // del contenedor, no tiene sentido acotarlos por separado.
    return await withChromiumSlot(async () => {
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
      }
    });
  } finally {
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
