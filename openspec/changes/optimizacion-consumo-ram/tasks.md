# Tareas: Optimización de Consumo de RAM

Las 4 fases son independientes — no hace falta completar una para deployar la siguiente. Orden sugerido para medir bien el impacto: **Fase 4 primero** (instrumentación, para tener una línea base de `rssMb` antes de tocar nada), después Fases 1-3 en cualquier orden.

## Fase 0: Línea base (antes de cualquier cambio)

- [x] 0.1 Registrar el promedio/pico actual de RAM reportado por Railway — **promedio 1.1GB, mínimo 0.49GB, rango normal 0.5-1.5GB; picos 3.2GB (OCR+IA), 2.9GB (procesamiento de imágenes), 2.8GB (requests simultáneos); distribución 24h: 35% en 0.5-0.7GB, 50% en 0.7-1.5GB, 10% en 1.5-2.5GB, 5% en picos 2.5-3.2GB** (ver `proposal.md`, tabla de línea base)
- [ ] 0.2 Confirmar el plan/límite de RAM del servicio en Railway (para saber qué tan cerca del límite están los picos de 3.2GB reportados — con un límite de 2GB, el margen antes de OOM es de solo ~0.8GB)

## Fase 4: Instrumentación de memoria (recomendado implementar primero)

- [x] 4.1 `src/lib/ocr/tesseract-service.ts`: agregar `isTesseractWorkerLoaded()` (getter sobre la variable `worker` existente)
- [x] 4.2 Crear `src/lib/observability/memory-logger.ts` con `startMemoryLogger()` (log periódico de `process.memoryUsage()` + estado de Tesseract/Chromium)
- [x] 4.3 `server.ts`: llamar `startMemoryLogger()` en el arranque
- [x] 4.4 Verificado en local (con `MEMORY_LOG_INTERVAL_MS=5000` para no esperar 5 min): el log `[Memory]` aparece con la forma esperada — `rssMb: 232` en frío, `tesseractLoaded: false`, `chromiumActive: 0`, `chromiumQueued: 0`
- [ ] 4.5 Deployar a Railway y confirmar que el log `[Memory]` aparece en los logs del servicio

## Fase 1: Eliminar precarga de Tesseract

- [x] 1.1 `server.ts`: eliminar el bloque de precarga (`initTesseractWorker().then(...)`) y su import; mantener el import de `shutdownTesseractWorker` (sigue usándose en el shutdown)
- [x] 1.2 Verificado en local: al arrancar el server, el log `[Tesseract] Worker listo` NO aparece (confirmado en `devserver.log`, arranque limpio sin ninguna línea `[Tesseract]`)
- [x] 1.3 Verificado con una factura real (foto JPEG) vía navegador (Playwright, admin logueado): tras `POST /api/facturas-proveedor/upload`, aparece por primera vez `[Tesseract] Inicializando worker (idioma: spa)...` → `[Tesseract] Worker listo ✅` (no antes) — el lazy-load funciona. El texto extraído se mandó a OpenRouter con éxito (`usedVision: true`, 31s, `openai/gpt-4o-mini`). **Hallazgo no relacionado a este cambio**: la request final devolvió `502` — `prisma.$transaction` (creación de ítems + matching en `process/route.ts`) excedió el timeout interactivo default de Prisma (5000ms, superado por 478ms). Es un bug preexistente, no introducido por este cambio (la transacción no fue tocada) — reportado aparte, no se corrige acá.
- [ ] 1.4 Deployar y comparar `rssMb` del log de memoria (Fase 4) en una réplica sin facturas procesadas, contra la línea base de Fase 0

## Fase 2: Semáforo de concurrencia de Chromium

- [x] 2.1 Crear `src/lib/chromium/chromium-semaphore.ts` (`withChromiumSlot`, `getChromiumSlotStats`, `ChromiumBusyError`)
- [x] 2.2 Envolver `browser.newPage()`/`page.pdf()` con `withChromiumSlot` en los 8 endpoints: `src/app/ver/dashboard/[period]/pdf/route.ts`, `pos/[period]/pdf/route.ts`, `inventario/[id]/pdf/route.ts`, `consig/[period]/pdf/route.ts`, `historial/[id]/pdf/route.ts`, `ticket/[id]/route.ts`, `remito/[id]/route.ts`, `gasto/[id]/route.ts`
- [x] 2.3 Agregar manejo de `ChromiumBusyError` → `HTTP 503` en el `catch` de cada uno de esos 8 endpoints
- [x] 2.4 `src/lib/ocr/ocr-engine.ts`: envolver `launchOcrBrowser()` dentro de `rasterizarPdf()` con `withChromiumSlot`
- [x] 2.5 `getChromiumSlotStats()` integrado en el memory-logger (Fase 4)
- [x] 2.6 Verificado con un script aislado (`withChromiumSlot` importado directo, sin HTTP) con `MAX_CHROMIUM_CONCURRENCY=1`: 3 tareas concurrentes de 2000ms cada una se sirven en serie — A a los 2001ms, B a los 4002ms, C a los 6001ms (no ~2000ms si corrieran en paralelo). También probado por HTTP real contra `/ver/dashboard/month/pdf` con 3 requests `curl` concurrentes: las 3 devolvieron `200`, con duraciones escalonadas consistentes con cola (no simultáneas)
- [x] 2.7 Verificado con el mismo script aislado: tarea A retiene el slot 25000ms (más que el timeout de cola de 20000ms), tarea B en cola recibe `ChromiumBusyError` a los 20001ms exactos ("Timeout esperando un slot de Chromium disponible") en vez de colgarse — en el endpoint HTTP esto se traduce a `503` (ver `route.ts`, rama `error instanceof ChromiumBusyError`)

## Fase 3: Apagado por inactividad del browser compartido de reportes

- [x] 3.1 `src/lib/chromium/resolve-executable-path.ts`: agregar `scheduleIdleShutdown()` + temporizador `.unref()` sobre `getSharedReportBrowser()`
- [x] 3.2 Verificado con `CHROMIUM_IDLE_SHUTDOWN_MS=8000`: generado un reporte real (`GET /ver/dashboard/month/pdf`, 200), esperados 12s sin pedir otro, apareció `[Chromium] Cerrando browser compartido por inactividad` en el log
- [x] 3.3 Verificado: un reporte pedido inmediatamente después del cierre por inactividad devolvió `200` con un PDF idéntico en tamaño al anterior (58606 bytes) — se relanza limpio, sin quedar en estado roto
- [ ] 3.4 Deployar con el default de producción (`CHROMIUM_IDLE_SHUTDOWN_MS=600000`, 10 min) y confirmar en los logs de Railway que el cierre ocurre en períodos sin tráfico de reportes

## Fase 5: Verificación final y comparación

- [ ] 5.1 Con las 4 fases deployadas, dejar correr en producción al menos 24-48hs y comparar `rssMb` promedio/pico (log de memoria) contra la línea base de Fase 0 y contra lo reportado por el dashboard de Railway
- [ ] 5.2 Si el promedio/pico no bajó de forma significativa, revisar los logs `[Memory]` en el momento de un pico para identificar si Tesseract/Chromium siguen siendo la causa o si hay otra fuente no cubierta por este cambio (documentar hallazgo como insumo para un cambio posterior, ej. mover OCR/IA a un worker externo — ver "Fuera de Alcance" en `proposal.md`)
