// src/lib/observability/memory-logger.ts
// Log periódico de memoria + estado de los recursos pesados (Tesseract,
// Chromium), para correlacionar con los picos que reporta Railway sin
// depender solo de su dashboard agregado.

// Imports relativos (no alias "@/"): este módulo se importa directo desde
// server.ts, que corre con tsx sin pasar por el resolver de paths de Next.js.
import { getChromiumSlotStats } from "../chromium/chromium-semaphore";
import { isTesseractWorkerLoaded } from "../ocr/tesseract-service";

const INTERVAL_MS = Number(process.env.MEMORY_LOG_INTERVAL_MS) || 5 * 60 * 1000;

export function startMemoryLogger() {
  const timer = setInterval(() => {
    const mem = process.memoryUsage();
    const chromium = getChromiumSlotStats();
    console.log("[Memory]", {
      rssMb: Math.round(mem.rss / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      externalMb: Math.round(mem.external / 1024 / 1024),
      tesseractLoaded: isTesseractWorkerLoaded(),
      chromiumActive: chromium.active,
      chromiumQueued: chromium.queued,
    });
  }, INTERVAL_MS);
  timer.unref();
}
