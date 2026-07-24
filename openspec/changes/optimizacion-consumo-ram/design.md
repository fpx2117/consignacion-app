# Diseño: Optimización de Consumo de RAM

Cubre las 4 partes de `proposal.md`. Cada parte es independiente entre sí — se pueden implementar y deployar en cualquier orden.

## Parte 1 — Eliminar precarga de Tesseract

### Cambio en `server.ts`

Diff conceptual, eliminando el bloque completo (líneas 175-179 actuales):

```typescript
// ELIMINAR:
// 7. Precargar Tesseract (OCR) para evitar timeout en el primer request
console.log("⏳ Precargando Tesseract worker (OCR)...");
initTesseractWorker().then(() => {
  console.log("✅ Tesseract worker precargado");
});
```

El import `initTesseractWorker` (línea 9) se elimina también, junto con `shutdownTesseractWorker` **solo si** deja de usarse — se sigue usando en el bloque de graceful shutdown (línea 190), así que ese import se mantiene (`shutdownTesseractWorker` sigue siendo válido: si el worker nunca se cargó, `tesseract-service.ts:97-104` ya maneja el caso `if (worker)` sin hacer nada).

No se toca `tesseract-service.ts` — `recognizeImage()` (línea 88-95) ya hace `await initTesseractWorker()` como primera línea, así que el lazy-load real ya existe, solo hay que dejar de adelantarlo.

### Log de verificación

Se mantiene el log `[Tesseract] Worker listo ✅` (`tesseract-service.ts:81`) tal cual — sirve como señal de "se cargó, y en qué momento" tanto en el modelo actual (precarga) como en el nuevo (bajo demanda), sin cambios de código ahí.

## Parte 2 y 3 — Semáforo de concurrencia + apagado por inactividad

### Nuevo módulo: `src/lib/chromium/chromium-semaphore.ts`

```typescript
// src/lib/chromium/chromium-semaphore.ts
// Límite de tareas de Chromium corriendo en simultáneo en este proceso
// (reportes PDF + rasterizado OCR comparten el mismo cupo: ambos consumen
// del mismo presupuesto de RAM del contenedor, no tiene sentido acotarlos
// por separado).

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
```

`ChromiumBusyError` se traduce a `HTTP 503` en los endpoints (ver abajo) en vez de dejar el request colgado indefinidamente.

### Uso en reportes PDF (8 endpoints, patrón idéntico)

Diff conceptual sobre `src/app/ver/dashboard/[period]/pdf/route.ts` (mismo patrón para el resto de `src/app/ver/**/pdf/route.ts` y `src/app/ver/{ticket,remito,gasto}/[id]/route.ts`):

```typescript
import {
  withChromiumSlot,
  ChromiumBusyError,
} from "@/lib/chromium/chromium-semaphore";

// ...dentro del try existente, reemplazando las líneas 253-264 actuales:
const pdfBytes = await withChromiumSlot(async () => {
  const browser = await getSharedReportBrowser();
  page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: "domcontentloaded" });
  await page.emulateMediaType("screen");

  const bytes = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" },
  });

  await page.close();
  page = null;
  return bytes;
});
```

El `catch` existente agrega una rama para `ChromiumBusyError`:

```typescript
} catch (error) {
  if (error instanceof ChromiumBusyError) {
    return NextResponse.json({ error: "Servidor ocupado generando otros reportes, reintentá en unos segundos." }, { status: 503 });
  }
  console.error("PDF DASHBOARD ERROR:", error);
  return NextResponse.json({ error: "Error generando reporte" }, { status: 500 });
}
```

El `finally { try { if (page) await page.close(); } catch {} }` existente no cambia — sigue siendo la red de seguridad si `withChromiumSlot` lanza antes de que `page` se limpie a `null`.

### Uso en OCR (`ocr-engine.ts`)

Diff conceptual sobre `rasterizarPdf()` (`src/lib/ocr/ocr-engine.ts:121-146`):

```typescript
import { withChromiumSlot } from "@/lib/chromium/chromium-semaphore";

export async function rasterizarPdf(
  buffer: Buffer,
  maxPaginas = 3,
): Promise<Buffer> {
  console.log("[OCR] Rasterizando PDF con Chromium...");
  const tempPath = path.join(
    os.tmpdir(),
    `ocr-factura-${crypto.randomUUID()}.pdf`,
  );
  await writeFile(tempPath, buffer);

  try {
    return await withChromiumSlot(async () => {
      const browser = await launchOcrBrowser();
      try {
        const page = await browser.newPage();
        const altoMaximo = 1600 * maxPaginas;
        await page.setViewport({
          width: 1240,
          height: Math.min(altoMaximo, 8000),
        });
        await page.goto(`file://${tempPath.replace(/\\/g, "/")}#toolbar=0`, {
          waitUntil: "networkidle0",
          timeout: 30000,
        });
        await new Promise((resolve) => setTimeout(resolve, 800));
        const screenshot = await page.screenshot({
          type: "png",
          fullPage: true,
        });
        return Buffer.from(screenshot);
      } finally {
        await browser.close().catch(() => {});
      }
    });
  } finally {
    await rm(tempPath, { force: true });
  }
}
```

`ChromiumBusyError` se propaga hasta `extraerTextoFactura()` → `procesarFacturaConIA()` → el `catch` genérico de `process/route.ts:172-191`, que ya cae en la rama `error instanceof Error` y devuelve `502` con el mensaje — aceptable sin cambios ahí (mensaje "Timeout esperando un slot de Chromium disponible" es suficientemente claro para el usuario que reintenta).

**Nota de implementación (no prevista en el diseño original):** envolver la asignación `page = await browser.newPage()` dentro del callback de `withChromiumSlot` hace que TypeScript (5.9, `strict: true`) sobre-angoste el tipo de `page` a `never` en el bloque `finally` de los 8 endpoints — un comportamiento conocido de su análisis de flujo de control al mutar una variable `let` capturada desde un closure async. Se resuelve con un cast explícito en el punto de lectura: `await (page as Page | null)?.close();` en vez de `await page?.close();`. Es un ajuste de tipos puro, sin cambio de comportamiento en runtime.

### Apagado por inactividad de `getSharedReportBrowser()`

Diff conceptual sobre `src/lib/chromium/resolve-executable-path.ts:55-76`:

```typescript
const IDLE_SHUTDOWN_MS =
  Number(process.env.CHROMIUM_IDLE_SHUTDOWN_MS) || 10 * 60 * 1000;

let sharedBrowser: Browser | null = null;
let launching: Promise<Browser> | null = null;
let idleTimer: NodeJS.Timeout | null = null;

function scheduleIdleShutdown() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    if (sharedBrowser) {
      console.log("[Chromium] Cerrando browser compartido por inactividad");
      await sharedBrowser.close().catch(() => {});
      sharedBrowser = null;
    }
  }, IDLE_SHUTDOWN_MS);
  idleTimer.unref(); // no debe mantener el proceso vivo solo por este timer
}

export async function getSharedReportBrowser(): Promise<Browser> {
  scheduleIdleShutdown();

  if (sharedBrowser?.connected) return sharedBrowser;

  if (!launching) {
    launching = launchReportBrowser()
      .then((browser) => {
        sharedBrowser = browser;
        browser.once("disconnected", () => {
          if (sharedBrowser === browser) sharedBrowser = null;
          if (idleTimer) clearTimeout(idleTimer);
        });
        return browser;
      })
      .finally(() => {
        launching = null;
      });
  }

  return launching;
}
```

`scheduleIdleShutdown()` se llama al **inicio** de cada `getSharedReportBrowser()` (antes de devolver la instancia existente), así que cada uso reinicia el temporizador — el browser solo se cierra si pasan `IDLE_SHUTDOWN_MS` sin ningún request de reporte nuevo. `.unref()` evita que este `setTimeout` por sí solo impida que el proceso termine en un shutdown limpio.

## Parte 4 — Instrumentación de memoria

### Nuevo módulo: `src/lib/observability/memory-logger.ts`

```typescript
// src/lib/observability/memory-logger.ts
// Log periódico de memoria + estado de los recursos pesados (Tesseract,
// Chromium), para correlacionar con los picos que reporta Railway sin
// depender solo de su dashboard agregado.

import { getChromiumSlotStats } from "@/lib/chromium/chromium-semaphore";
import { isTesseractWorkerLoaded } from "@/lib/ocr/tesseract-service";

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
```

Requiere agregar `isTesseractWorkerLoaded()` a `tesseract-service.ts` (getter trivial sobre la variable `worker` existente, línea 10):

```typescript
export function isTesseractWorkerLoaded(): boolean {
  return worker !== null;
}
```

### Arranque en `server.ts`

Se llama una vez, junto al resto de la inicialización (reemplazando el bloque eliminado en Parte 1):

```typescript
import { startMemoryLogger } from "./src/lib/observability/memory-logger";
// ...
startMemoryLogger();
```

`rss` (Resident Set Size) es la métrica que más se acerca a lo que Railway reporta como "memoria usada" — incluye heap de V8 + memoria de Chromium/Tesseract vía bindings nativos, que `heapUsed` no captura.

## Variables de entorno nuevas (todas opcionales, con default)

| Variable                    | Default           | Uso                                                                     |
| --------------------------- | ----------------- | ----------------------------------------------------------------------- |
| `MAX_CHROMIUM_CONCURRENCY`  | `2`               | Tareas de Chromium (reportes + OCR) simultáneas permitidas              |
| `CHROMIUM_IDLE_SHUTDOWN_MS` | `600000` (10 min) | Tiempo de inactividad antes de cerrar el browser compartido de reportes |
| `MEMORY_LOG_INTERVAL_MS`    | `300000` (5 min)  | Frecuencia del log de memoria                                           |

Ninguna es obligatoria — el sistema funciona con los defaults sin configuración adicional en Railway.

## Compatibilidad hacia atrás

1. **Sin factura ni reporte alguno**: comportamiento idéntico a hoy, salvo que el proceso arranca sin cargar Tesseract (menos RAM desde el primer segundo).
2. **Carga normal (1-2 reportes/OCR a la vez)**: el semáforo nunca se llena con el default de 2, cero cambio de comportamiento observable para el usuario.
3. **Carga alta simultánea**: en vez de que Railway mate el proceso por OOM (lo que hoy puede pasar en un pico de 3.2GB si el límite del plan es menor), algunos requests reciben `503`/`502` con mensaje claro y pueden reintentar — degradación controlada en vez de caída del proceso completo.
4. **Reportes espaciados en el tiempo** (el caso común): el browser compartido se recicla solo tras 10 minutos sin uso; el siguiente reporte paga el mismo ~2s de arranque que ya paga hoy en cada redeploy.

## Riesgos técnicos adicionales (no cubiertos en `proposal.md`)

- El semáforo es en memoria del proceso — si Railway corre más de una réplica del proceso web, cada réplica tiene su propio cupo de `MAX_CHROMIUM_CONCURRENCY`, no es un límite global cross-réplica. Es aceptable para este cambio (el objetivo es acotar el consumo _por proceso_, que es lo que Railway mide y factura), pero vale documentarlo explícitamente para no asumir que "2" es un límite de toda la app.
- `getChromiumSlotStats()`/`isTesseractWorkerLoaded()` son funciones de solo lectura sin side-effects — no hay riesgo de que la instrumentación en sí misma consuma RAM relevante o interfiera con el semáforo.

## Roadmap de Implementación (por fases)

### Fase 1 — Tesseract lazy-load (la más simple y de menor riesgo)

1. `server.ts`: eliminar la precarga (líneas 176-179) y el import correspondiente de `initTesseractWorker`.

**Listo cuando**: el log `[Tesseract] Worker listo` no aparece hasta que se procesa la primera factura con imagen/PDF escaneado.

### Fase 2 — Semáforo de concurrencia de Chromium

1. Crear `src/lib/chromium/chromium-semaphore.ts`.
2. Envolver `browser.newPage()` en los 8 endpoints de reportes con `withChromiumSlot`.
3. Envolver `launchOcrBrowser()` (dentro de `rasterizarPdf`) con `withChromiumSlot`.
4. Agregar manejo de `ChromiumBusyError` → `503` en los endpoints de reportes.

**Listo cuando**: generar 5 reportes en paralelo (con `MAX_CHROMIUM_CONCURRENCY=2`) resulta en como máximo 2 procesos de Chromium activos a la vez, verificable con el log de instrumentación (Fase 4).

### Fase 3 — Apagado por inactividad del browser compartido

1. `resolve-executable-path.ts`: temporizador de inactividad sobre `getSharedReportBrowser()`.

**Listo cuando**: tras generar un reporte y esperar `CHROMIUM_IDLE_SHUTDOWN_MS`, el log `[Chromium] Cerrando browser compartido por inactividad` aparece sin que se haya pedido ningún reporte nuevo en el medio.

### Fase 4 — Instrumentación de memoria

1. `tesseract-service.ts`: agregar `isTesseractWorkerLoaded()`.
2. Crear `src/lib/observability/memory-logger.ts`.
3. `server.ts`: llamar `startMemoryLogger()` en el arranque.

**Listo cuando**: los logs de Railway muestran una línea `[Memory]` cada `MEMORY_LOG_INTERVAL_MS` con `rssMb`, `tesseractLoaded` y el estado del semáforo de Chromium.

---

Las 4 fases son independientes y aditivas — se puede implementar y deployar cualquier subconjunto sin dejar nada roto ni a medio camino. El orden sugerido (1→4) va de menor a mayor complejidad/riesgo, y la Fase 4 (instrumentación) idealmente se deploya primero en la práctica para tener una línea base de `rssMb` _antes_ de las Fases 1-3, aunque numéricamente se liste al final por depender de `getChromiumSlotStats()` de la Fase 2.
