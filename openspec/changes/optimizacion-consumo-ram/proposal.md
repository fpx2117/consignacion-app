# Propuesta: Optimización de Consumo de RAM

## Intención

### Datos de Railway (línea base, reportados por el usuario)

| Métrica                | Valor                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------- |
| Promedio (baseline)    | ~1.1 GB                                                                                |
| Mínimo                 | 0.49 GB                                                                                |
| Rango normal           | 0.5 – 1.5 GB                                                                           |
| Pico máximo registrado | 3.2 GB (durante procesamiento de OCR + IA)                                             |
| Segundo pico           | ~2.9 GB (procesamiento de imágenes)                                                    |
| Tercer pico            | ~2.8 GB (múltiples requests simultáneos)                                               |
| Distribución 24h       | 35% del tiempo en 0.5-0.7GB, 50% en 0.7-1.5GB, 10% en 1.5-2.5GB, 5% en picos 2.5-3.2GB |

1.1GB de promedio es alto para un proceso Node/Next.js que sirve un POS — el propio dashboard de Railway lo señala como fuera de rango típico. Con un límite de plan de 2GB, los picos de 3.2GB dejan solo ~0.8GB de margen antes de que Railway mate el proceso por OOM, lo cual es consistente con que el "tercer pico" ocurra específicamente en momentos de "múltiples requests simultáneos" — apunta a un problema de **concurrencia sin límite**, no solo de baseline alto.

Un análisis previo (herramienta externa, no este repo) atribuyó el problema a tres causas: precarga de Tesseract, "duplicación" de Puppeteer/puppeteer-core, y "dependencias pesadas" en general (Sharp, Socket.IO, Recharts). Revisé el código fuente directamente y **dos de esas tres causas están mal diagnosticadas** — y esa misma herramienta las repite en cada iteración del análisis, así que vale dejarlo explícito acá:

- **Puppeteer + puppeteer-core NO están duplicados.** Es una elección deliberada: `puppeteer` (con su propio Chromium empaquetado) para desarrollo local, `puppeteer-core` + `@sparticuz/chromium` para Railway/Linux, porque el Chromium de `puppeteer` normal no corre confiablemente en ese entorno (`src/lib/chromium/resolve-executable-path.ts:1-13`, comentario explícito). La sugerencia recurrente de "usar solo puppeteer-core + Chromium externo" **ya es lo que hace el código en producción** (`launchLinux()`, línea 19-29) — en local (`launchLocal()`, línea 31-37) se usa `puppeteer` normal porque instalar `@sparticuz/chromium` en Windows/Mac no tiene sentido. Eliminar cualquiera de los dos paquetes rompe un ambiente. No hay nada que optimizar acá.
- **"Dependencias pesadas" (Sharp, Socket.IO, Recharts, Radix UI) no tienen evidencia de ser culpables de RAM en runtime del proceso web.** Recharts/Radix son código de cliente (bundle del navegador, no corren en el servidor). Socket.IO mantiene conexiones abiertas pero su footprint por conexión es de KBs, no cientos de MB. Sharp sí corre server-side, pero solo durante el preprocesamiento de una imagen puntual (`src/lib/ocr/ocr-engine.ts:48-65, 87-109`) — el buffer se libera apenas termina ese request, no queda residente. Es procesamiento necesario para el pipeline de OCR (achicar/normalizar la imagen antes de mandarla a Tesseract o a la IA de visión); moverlo al cliente significaría re-implementar ese preprocesamiento en el navegador del usuario (que en un POS suele ser una tablet/celular con menos CPU que el servidor) sin ninguna evidencia de que sea la causa de los picos — no se incluye en esta propuesta.

Lo que sí encontré, con evidencia concreta en el código, son tres causas reales — una de ellas (Parte 2) no estaba en el análisis original y es la más probable explicación de los **picos** (vs. el promedio):

### Causa 1 — Tesseract se precarga siempre, la use o no ese proceso

`server.ts:176-179` llama `initTesseractWorker()` incondicionalmente en cada arranque del servidor, sin esperar a que haya al menos una factura para procesar. Esto carga el core WASM de Tesseract + el modelo de idioma español en memoria de forma **permanente**, durante toda la vida del proceso, incluso en réplicas donde nunca se sube una factura. `tesseract-service.ts:88-95` (`recognizeImage`) ya llama a `initTesseractWorker()` internamente si el worker no existe — la precarga en `server.ts` es estrictamente redundante con ese fallback, solo sirve para adelantar el costo del primer request en vez de evitarlo.

### Causa 2 — El browser de Chromium para reportes PDF nunca se cierra y no tiene límite de concurrencia

`getSharedReportBrowser()` (`src/lib/chromium/resolve-executable-path.ts:58-76`) mantiene **un único proceso de Chromium vivo indefinidamente** una vez que se lanza, reutilizado por los 8 endpoints de reportes (`src/app/ver/dashboard/[period]/pdf/route.ts` y equivalentes para pos, inventario, consig, historial, ticket, remito, gasto). Dos problemas:

1. **Nunca se cierra proactivamente** — solo se relanza si Railway lo mata o se desconecta solo. Una vez que se generó el primer reporte, ese Chromium (típicamente 100-250MB) queda residente para siempre, aunque no se vuelva a pedir un reporte en horas.
2. **Sin límite de páginas concurrentes** — cada endpoint hace `page = await browser.newPage()` (ej. `src/app/ver/dashboard/[period]/pdf/route.ts:254`) sin ninguna cola ni semáforo. Si llegan varios requests de reportes al mismo tiempo (ej. varios usuarios exportando PDFs, o un mismo usuario con varias pestañas), Chromium abre un proceso renderer nuevo por cada `newPage()` **en paralelo, sin techo**. Esto es el candidato más fuerte para explicar los picos de 3.2GB — no el promedio.

### Causa 3 — El pipeline pesado corre inline en el mismo proceso que sirve HTTP, sin aislamiento ni cola

`POST /api/facturas-proveedor/[id]/process` (`src/app/api/facturas-proveedor/[id]/process/route.ts:76-80`) ejecuta `procesarFacturaConIA()` — que internamente hace `extraerTextoFactura()` (Tesseract + Sharp + potencialmente `launchOcrBrowser()` para PDFs escaneados) — **dentro del mismo proceso Node que atiende el resto del tráfico web**, sin cola ni límite. `launchOcrBrowser()` (`src/lib/ocr/ocr-engine.ts:121-146`) lanza una instancia _nueva_ de Chromium por cada PDF escaneado que necesita rasterizado, con el flag `--single-process` (`resolve-executable-path.ts:96`), que reduce la cantidad de procesos del SO pero concentra más memoria en uno solo. Esta instancia se cierra correctamente en el `finally` (no es una fuga), pero si coincide en el tiempo con varios reportes PDF (Causa 2) y/o varias facturas procesándose a la vez, compiten por RAM sin ninguna coordinación entre sí.

### Causa 4 (síntoma, no causa) — No hay instrumentación de memoria propia

Hoy la única visibilidad de RAM es el dashboard agregado de Railway (promedio + pico, sin desglose). No hay ningún log ni endpoint que diga, en el momento del pico, cuántas páginas de Chromium había abiertas, si el worker de Tesseract estaba cargado, o cuánto pesaba el heap de V8. Esto hace que cualquier ajuste de las Causas 1-3 sea difícil de verificar en producción sin agregar el mismo tipo de instrumentación primero.

## Alcance

1. **Tesseract lazy-load real**: eliminar la llamada a `initTesseractWorker()` en `server.ts` (líneas 176-179). El lazy-load de fallback que ya existe en `recognizeImage()` (`tesseract-service.ts:92`) pasa a ser el único punto de carga — el worker solo se instancia la primera vez que una factura efectivamente necesita OCR local.
2. **Límite de concurrencia para tareas de Chromium** (reportes PDF + rasterizado OCR): un semáforo compartido que acote cuántas tareas de Chromium (páginas de reporte + instancias de OCR) pueden correr al mismo tiempo en todo el proceso, en vez de dejarlas competir sin límite.
3. **Apagado por inactividad del browser compartido de reportes**: si `getSharedReportBrowser()` no recibe un `newPage()` en N minutos, se cierra proactivamente en vez de quedar residente indefinidamente.
4. **Instrumentación mínima de memoria**: log periódico de `process.memoryUsage()` + estado de Tesseract/Chromium (cargado/no, slots en uso), para poder correlacionar con los picos que reporta Railway sin depender solo de su dashboard.

### Fuera de Alcance

- Mover el pipeline de OCR/IA a un worker externo real (proceso o servicio separado del que sirve HTTP) — es la mitigación más robusta a la Causa 3, pero es un cambio de arquitectura de infraestructura, no de código de aplicación. Se deja como recomendación para un cambio posterior si las mitigaciones de este cambio no alcanzan.
- Reemplazar Tesseract por un motor más liviano o eliminarlo del pipeline — cambiaría el comportamiento de extracción/costo del flujo de facturas, no es un cambio de performance puro.
- Eliminar `puppeteer` o `puppeteer-core` — ambos son necesarios (ver Causa 1 del análisis original, descartada arriba).
- Auditoría de dependencias de `package.json` no usadas (ej. hipotético "cobe" u otras) — no encontré evidencia de que afecten RAM en runtime; si se quiere ese barrido, es un cambio de bundle-size, ya cubierto parcialmente por `openspec/specs/performance/spec.md` (REQ-12).
- Migrar Chromium de `--single-process` a multi-proceso en `launchOcrBrowser()` — requiere medición propia primera (ver Criterios de Éxito) antes de decidir si vale la pena el trade-off de estabilidad en Railway.

## Enfoque

### Decisión 1: Quitar la precarga de `server.ts`, no reemplazarla por otro mecanismo de "warm-up"

**Elección**: borrar las líneas 176-179 de `server.ts`. El primer request que necesite OCR local paga el costo de carga (~2-3s), tal como ya ocurre hoy si el proceso se reinicia y llega una factura antes de que la precarga termine (la precarga es asíncrona, no bloquea `listen()`).

**Alternativa descartada**: mover la precarga a un `setTimeout` diferido o a un cron de "warm-up" que la dispare unos segundos después del boot. Se descarta porque no resuelve el problema — el worker se sigue cargando siempre, solo se retrasa unos segundos. El objetivo es que **no se cargue en absoluto** en réplicas que no procesan facturas.

**Justificación**: el comentario original en `tesseract-service.ts:2-3` dice que la precarga existe para "evitar timeout 502 en el primer request" — pero eso solo importa si hay un timeout ajustado agresivamente en el proxy/load balancer de Railway. Ese timeout no se toca en este cambio; si el primer OCR después de un deploy resulta demasiado lento en la práctica, es preferible subir ese timeout puntual (configuración de infraestructura) antes que pagar el costo de RAM permanente en todas las réplicas.

### Decisión 2: Un semáforo genérico para "slots de Chromium", no uno por endpoint

**Elección**: un único límite compartido (`MAX_CHROMIUM_CONCURRENCY`, default 2) que cubra tanto `newPage()` en reportes como `launchOcrBrowser()` en OCR — ambos consumen del mismo presupuesto de RAM del contenedor, así que deben competir por el mismo cupo, no por cupos separados que sumados excedan la memoria disponible.

**Alternativa descartada**: límites independientes por tipo de tarea (ej. "2 reportes + 2 OCRs" = 4 tareas de Chromium simultáneas posibles). Se descarta porque no resuelve el problema real: lo que importa es cuánta RAM total consume Chromium en un momento dado, no cuántas tareas de cada tipo hay.

**Justificación**: es la forma más simple de acotar el peor caso sin rediseñar cómo se lanzan las tareas — un `await acquireChromiumSlot()` / `release()` alrededor del código existente, sin tocar la lógica de generación de PDF/rasterizado en sí.

### Decisión 3: Apagar el browser compartido por inactividad, no por cada request

**Elección**: temporizador de inactividad (default 10 minutos) sobre `getSharedReportBrowser()` — si no se abrió ninguna página nueva en ese lapso, se cierra el browser.

**Alternativa descartada**: cerrar el browser al final de cada request de reporte (volver a "un browser por request"). Se descarta porque revierte la optimización original documentada en `resolve-executable-path.ts:48-54` (arrancar Chromium toma ~2s, se paga en cada request si no se comparte).

**Justificación**: mantiene el beneficio de compartir el browser entre requests cercanos en el tiempo (el caso común: alguien exportando varios reportes seguidos), pero libera la RAM cuando no hay actividad de reportes por un rato — que es la mayor parte del tiempo de vida del proceso.

## Áreas Afectadas

| Área                                                                                           | Impacto    | Descripción                                                                                                      |
| ---------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------- |
| `server.ts`                                                                                    | Modificado | Se elimina la precarga de Tesseract (líneas 176-179)                                                             |
| `src/lib/chromium/resolve-executable-path.ts`                                                  | Modificado | Apagado por inactividad de `getSharedReportBrowser()`; slots de concurrencia para `launchOcrBrowser()`           |
| `src/lib/chromium/chromium-semaphore.ts` (o similar)                                           | Nuevo      | Semáforo compartido de concurrencia para tareas de Chromium                                                      |
| `src/app/ver/**/pdf/route.ts` (8 archivos) y `src/app/ver/{ticket,remito,gasto}/[id]/route.ts` | Modificado | `await page.close()` sigue igual; se agrega adquisición/liberación del semáforo alrededor de `browser.newPage()` |
| `src/lib/ocr/ocr-engine.ts`                                                                    | Modificado | `rasterizarPdf()` adquiere/libera el mismo semáforo antes de `launchOcrBrowser()`                                |
| `src/lib/observability/memory-logger.ts` (o similar)                                           | Nuevo      | Log periódico de `process.memoryUsage()` + estado de Tesseract/Chromium                                          |

## Riesgos

| Riesgo                                                                                                                                                   | Probabilidad    | Mitigación                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primer OCR local después de un deploy/restart es más lento (~2-3s de carga de Tesseract)                                                                 | Alta (esperado) | Es el trade-off explícito de la Decisión 1 — documentar en el rollout; si el timeout del proxy de Railway es un problema real, ajustar ese timeout en vez de revertir                   |
| Bajo carga alta, reportes/OCR se encolan en vez de correr en paralelo, aumentando la latencia percibida de un reporte puntual                            | Media           | Límite configurable por variable de entorno (`MAX_CHROMIUM_CONCURRENCY`), con timeout de espera en cola y mensaje de error claro si se supera (evita colgar el request indefinidamente) |
| Apagar el browser compartido por inactividad hace que el primer reporte después de una pausa larga vuelva a pagar el arranque de ~2s                     | Alta (esperado) | Mismo trade-off que ya existe hoy en cada redeploy — aceptable porque libera RAM la mayor parte del tiempo                                                                              |
| El semáforo compartido introduce un punto único que, si tiene un bug (ej. no libera el slot en un path de error), bloquea todos los reportes/OCR futuros | Baja            | `try/finally` obligatorio alrededor de cada adquisición, mismo patrón que ya usa el código existente para `page.close()`                                                                |

## Plan de Reversión (Rollback)

1. **Tesseract**: revertir el commit que borra la precarga en `server.ts` — vuelve a precargar en boot, comportamiento actual restaurado.
2. **Semáforo de Chromium**: es aditivo (envuelve llamadas existentes) — revertirlo significa quitar el `acquire`/`release`, las funciones de Chromium siguen funcionando igual que hoy sin límite.
3. **Apagado por inactividad**: revertir deja el browser compartido viviendo indefinidamente, como hoy.
4. **Instrumentación**: puramente aditiva (logs), no afecta ningún flujo funcional — no requiere rollback especial.

## Dependencias

Ninguna dependencia externa nueva — el semáforo se implementa con primitivas de JS (`Promise`, cola en memoria), sin librerías adicionales.

## Criterios de Éxito

- [ ] En una réplica donde no se procesa ninguna factura, el worker de Tesseract nunca se instancia (verificable por ausencia del log `[Tesseract] Worker listo`).
- [ ] Generar 5 reportes PDF en paralelo no abre más de `MAX_CHROMIUM_CONCURRENCY` páginas de Chromium simultáneas (verificable con el log de instrumentación).
- [ ] El browser compartido de reportes se cierra (log de cierre) tras el período de inactividad configurado, si no se pidió ningún reporte en ese lapso.
- [ ] El log de memoria periódico permite ver, para cualquier ventana de tiempo, el heap de Node + si Tesseract está cargado + slots de Chromium en uso, sin depender del dashboard de Railway.
- [ ] El consumo promedio reportado por Railway baja de forma medible frente a la línea base registrada arriba (1.1GB promedio / 3.2GB pico máximo).
- [ ] El "tercer pico" (2.8GB, atribuido por Railway a "múltiples requests simultáneos") deja de ocurrir sin límite — con el semáforo de Chromium activo, ese escenario debería traducirse en `503`s controlados en vez de un pico de RAM sin techo.
