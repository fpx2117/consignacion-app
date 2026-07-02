// src/lib/ocr/tesseract-service.ts
// Servicio singleton de Tesseract.js con precarga al iniciar el server.
// Evita descargar el modelo de idioma en el primer request (solución al timeout 502).
// Cachea el worker para reutilizarlo en toda la vida del proceso.

import { createWorker, type Worker } from "tesseract.js";
import path from "path";
import { existsSync } from "fs";

let worker: Worker | null = null;
let initializing: Promise<Worker> | null = null;

/**
 * Resuelve el path al worker-script de tesseract.js.
 *
 * En Railway, Next.js bundlea el código y __dirname no apunta a node_modules,
 * así que primero intentamos resolver desde process.cwd() (que en Railway es /app).
 */
function resolveWorkerPath(): string {
  // 1. Ruta desde process.cwd() — funciona en Railway runtime (/app/node_modules/...)
  const cwdPath = path.join(
    process.cwd(),
    "node_modules",
    "tesseract.js",
    "src",
    "worker-script",
    "node",
    "index.js"
  );
  if (existsSync(cwdPath)) {
    return cwdPath;
  }
  // 2. Fallback: resolver relativo a este archivo (src/lib/ocr/tesseract-service.ts)
  return path.join(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "node_modules",
    "tesseract.js",
    "src",
    "worker-script",
    "node",
    "index.js"
  );
}

const WORKER_PATH = resolveWorkerPath();

export async function initTesseractWorker(): Promise<Worker> {
  if (worker) return worker;
  if (initializing) return initializing;

  initializing = (async () => {
    console.log("[Tesseract] Inicializando worker (idioma: spa)...");
    console.log("[Tesseract] Worker path:", WORKER_PATH);
    const newWorker = await createWorker("spa", 1, {
      workerPath: WORKER_PATH,
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

export function isTesseractWorkerLoaded(): boolean {
  return worker !== null;
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
