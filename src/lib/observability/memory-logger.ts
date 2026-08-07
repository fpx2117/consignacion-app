// src/lib/observability/memory-logger.ts
// Log periódico de memoria + estado de recursos pesados (Chromium, usado por
// los reportes PDF), para correlacionar con los picos que reporta Railway sin
// depender solo de su dashboard agregado.
//
// Tesseract ya no se instrumenta acá: el OCR de facturas se migró a visión
// directa de OpenRouter (sin OCR local).

// Imports relativos (no alias "@/"): este módulo se importa directo desde
// server.ts, que corre con tsx sin pasar por el resolver de paths de Next.js.
import { getChromiumSlotStats } from "../chromium/chromium-semaphore";

const INTERVAL_MS = Number(process.env.MEMORY_LOG_INTERVAL_MS) || 5 * 60 * 1000;

export function startMemoryLogger() {
  const timer = setInterval(() => {
    const mem = process.memoryUsage();
    const chromium = getChromiumSlotStats();
    console.log("[Memory]", {
      rssMb: Math.round(mem.rss / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      externalMb: Math.round(mem.external / 1024 / 1024),
      chromiumActive: chromium.active,
      chromiumQueued: chromium.queued,
    });
  }, INTERVAL_MS);
  timer.unref();
}
