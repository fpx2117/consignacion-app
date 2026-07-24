// src/lib/chromium/chromium-semaphore.ts
// Límite de tareas de Chromium corriendo en simultáneo en este proceso
// (reportes PDF + rasterizado OCR comparten el mismo cupo: ambos consumen
// del mismo presupuesto de RAM del contenedor, no tiene sentido acotarlos
// por separado). Límite es por proceso, no global entre réplicas.

const MAX_CONCURRENCY = Number(process.env.MAX_CHROMIUM_CONCURRENCY) || 2;
const ACQUIRE_TIMEOUT_MS = 20_000;

let active = 0;
const queue: Array<() => void> = [];

export class ChromiumBusyError extends Error {}

async function acquire(): Promise<void> {
  if (active < MAX_CONCURRENCY) {
    active += 1;
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      const idx = queue.indexOf(onTurn);
      if (idx >= 0) queue.splice(idx, 1);
      reject(
        new ChromiumBusyError(
          "Timeout esperando un slot de Chromium disponible",
        ),
      );
    }, ACQUIRE_TIMEOUT_MS);

    function onTurn() {
      clearTimeout(timeout);
      active += 1;
      resolve();
    }

    queue.push(onTurn);
  });
}

function release(): void {
  active = Math.max(0, active - 1);
  const next = queue.shift();
  if (next) next();
}

/** Ejecuta `fn` con un slot de Chromium reservado; libera el slot siempre, incluso si `fn` lanza. */
export async function withChromiumSlot<T>(fn: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}

export function getChromiumSlotStats() {
  return { active, queued: queue.length, max: MAX_CONCURRENCY };
}
