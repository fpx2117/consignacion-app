// src/lib/ocr/tesseract-service.ts
// Servicio singleton de Tesseract.js con precarga al iniciar el server.
// Evita descargar el modelo de idioma en el primer request (solución al timeout 502).
// Cachea el worker para reutilizarlo en toda la vida del proceso.

import { createWorker, type Worker } from "tesseract.js";

let worker: Worker | null = null;
let initializing: Promise<Worker> | null = null;

export async function initTesseractWorker(): Promise<Worker> {
  if (worker) return worker;
  if (initializing) return initializing;

  initializing = (async () => {
    console.log("[Tesseract] Inicializando worker (idioma: spa)...");
    const newWorker = await createWorker("spa", 1, {
      logger: (message) => {
        if (message.status === "loading tesseract core") {
          console.log("[Tesseract] Cargando core WASM...");
        } else if (message.status === "initializing tesseract") {
          console.log("[Tesseract] Inicializando motor...");
        } else if (message.status === "loading language traineddata") {
          console.log("[Tesseract] Descargando datos de idioma (spa)...");
        } else if (message.status === "initializing api") {
          console.log("[Tesseract] Inicializando API...");
        } else if (message.status === "recognizing text") {
          // No loguear cada progreso de reconocimiento para no saturar
        } else {
          console.log("[Tesseract]", message.status);
        }
      },
      cachePath: "/tmp/tesseract-cache",
      // No descargar el idioma si ya está cacheado
      langPath: undefined,
    });

    worker = newWorker;
    console.log("[Tesseract] Worker listo ✅");
    return newWorker;
  })();

  return initializing;
}

export async function recognizeImage(buffer: Buffer): Promise<{
  texto: string;
  confianza: number;
}> {
  const activeWorker = await initTesseractWorker();
  const { data } = await activeWorker.recognize(buffer);
  return { texto: data.text, confianza: data.confidence };
}

export async function shutdownTesseractWorker() {
  if (worker) {
    console.log("[Tesseract] Terminando worker...");
    await worker.terminate();
    worker = null;
    initializing = null;
    console.log("[Tesseract] Worker terminado");
  }
}
