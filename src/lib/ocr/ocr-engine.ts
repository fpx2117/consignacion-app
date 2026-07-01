// src/lib/ocr/ocr-engine.ts
// Motor de OCR reutilizable: mantiene un worker de Tesseract.js como singleton
// (el servidor de este proyecto es un proceso Node persistente vía server.ts,
// no serverless, así que evitamos reinicializar el modelo de idioma en cada request).
// También resuelve la rasterización de PDFs a imagen reutilizando Puppeteer,
// que ya es una dependencia del proyecto (evita sumar `canvas`/poppler).

import path from "path";
import { mkdir, writeFile, rm } from "fs/promises";
import os from "os";
import crypto from "crypto";
import sharp from "sharp";
import { createWorker, type Worker } from "tesseract.js";

const CACHE_DIR = path.join(process.cwd(), ".cache", "tesseract");

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      await mkdir(CACHE_DIR, { recursive: true });
      return createWorker("spa", undefined, { cachePath: CACHE_DIR });
    })();
  }
  return workerPromise;
}

export type OcrResultado = {
  texto: string;
  confianza: number;
};

/** Preprocesa la imagen (escala de grises + normalizado) para mejorar el reconocimiento. */
async function preprocesarImagen(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate() // respeta orientación EXIF (fotos de celular)
    .grayscale()
    .normalize()
    .toFormat("png")
    .toBuffer();
}

export async function reconocerTexto(buffer: Buffer): Promise<OcrResultado> {
  const worker = await getWorker();
  const preprocesada = await preprocesarImagen(buffer);
  const { data } = await worker.recognize(preprocesada);
  return { texto: data.text, confianza: data.confidence };
}

/**
 * Rasteriza un PDF a una imagen PNG usando el visor de PDF nativo de Chromium
 * (vía Puppeteer). Simplificación pragmática de PoC: en vez de una imagen por
 * página, se captura el documento completo en una sola captura larga
 * (scroll completo), acotada por `maxPaginas` como límite de alto renderizado
 * para no procesar documentos desmedidos.
 */
export async function rasterizarPdf(buffer: Buffer, maxPaginas = 5): Promise<Buffer> {
  const puppeteer = await import("puppeteer");
  const tempPath = path.join(os.tmpdir(), `ocr-factura-${crypto.randomUUID()}.pdf`);
  await writeFile(tempPath, buffer);

  const browser = await puppeteer.default.launch({ headless: true });
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
    await browser.close();
    await rm(tempPath, { force: true });
  }
}

export function esPdf(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

export function esImagenSoportada(mimeType: string): boolean {
  return /^image\/(png|jpe?g|webp|bmp)$/i.test(mimeType);
}
