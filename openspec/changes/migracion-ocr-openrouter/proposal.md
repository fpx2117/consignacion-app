# Propuesta: Migración del motor de extracción IA de facturas de Modal a OpenRouter

> **Estado: implementado.** Este documento describe un cambio ya aplicado (commit `120d196`), no una propuesta pendiente. Se documenta acá para que el circuito completo quede trazado en OpenSpec.

## Intención

El pipeline de facturas de proveedor (`FacturaProveedor`/`FacturaProveedorItem`, ver `openspec/changes/ocr-pipeline-inteligente/proposal.md` para el diseño de matching) usaba Modal.com para correr un modelo de visión (Qwen 3.6 35B en GPU H100) que recibía la imagen/PDF de la factura y devolvía JSON estructurado. Esto resultó inviable operativamente:

- Una sola factura llegó a costar más de USD 3 (Modal cobra GPU/CPU/memoria encendida, no tokens).
- El endpoint escala a 0 por inactividad; el primer request tras un rato sin uso tardaba 1-3 minutos (503 mientras arranca).
- Ninguno de los dos problemas se resuelve ajustando parámetros — son inherentes a facturar por infraestructura dedicada en vez de por uso real.

Se migró el motor de extracción a **OpenRouter** (facturación por tokens), manteniendo intacto el resto del pipeline (matching por capas, aprendizaje de alias, estados, revisión manual) que ya funcionaba bien.

## Alcance

### Dentro del Alcance

1. Reemplazo de `src/lib/modal/ocr-client.ts` (llamaba a Modal con la imagen/PDF completo) por `src/lib/ai/openrouter-client.ts` + `src/lib/ai/invoice-ai-parser.ts` (le manda a la IA sólo texto ya extraído localmente).
2. Extracción de texto barata centralizada en `src/lib/ocr/extraer-texto-factura.ts` (PDF nativo / OCR Tesseract para escaneados e imágenes) — antes esta lógica vivía duplicada en un pipeline OCR viejo sin IA.
3. Prompt y JSON schema generados dinámicamente desde una config declarativa (`src/modules/invoices/config/invoice-extraction.config.ts`), en vez de hardcodeados en un string.
4. Columnas de auditoría IA en `FacturaProveedor` (`iaRespuestaCruda`, `iaModeloUsado`, `iaTokensUsados`); se elimina `modalJobId` (nunca se usó).
5. Eliminación del pipeline OCR viejo (`src/app/api/productos/ocr-factura/*`, diálogo de UI asociado, tipos/métodos de `apiService.ts`) — quedó sin referencias activas desde que existe el pipeline `facturas-proveedor/*`.
6. Variables de entorno: se retiran `MODAL_*`/`OCR_COLD_START_*`, se agregan `OPENROUTER_API_KEY`/`OPENROUTER_MODEL`/`OPENROUTER_BASE_URL`/`OPENROUTER_MAX_INPUT_CHARS`/`OPENROUTER_REASONING_EFFORT`.

### Fuera del Alcance

- Matching de productos, aprendizaje de alias, UI de revisión — sin cambios (ver `ocr-pipeline-inteligente/proposal.md`).
- Envío de imágenes/PDF a la IA — deliberadamente descartado: en el MVP sólo se manda texto, para mantener el costo por tokens predecible.
- Caché de respuesta IA por hash de archivo/texto entre facturas distintas — no implementado; el único gate contra reprocesamiento accidental es el estado (`PROCESABLES` en `process/route.ts`).

## Áreas Afectadas

| Área                                                             | Impacto    | Descripción                                                                                      |
| ---------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------ |
| `src/lib/modal/`                                                 | Eliminado  | Cliente de Modal completo                                                                        |
| `src/lib/ai/openrouter-client.ts`                                | Creado     | Cliente HTTP de bajo nivel a OpenRouter                                                          |
| `src/lib/ai/invoice-ai-parser.ts`                                | Creado     | Orquestador: texto → prompt → OpenRouter → validación                                            |
| `src/lib/ocr/extraer-texto-factura.ts`                           | Creado     | Extracción de texto centralizada (reutiliza `ocr-engine.ts`/`tesseract-service.ts`, sin cambios) |
| `src/modules/invoices/config/invoice-extraction.config.ts`       | Creado     | Config declarativa de campos + builders de prompt/schema/validación                              |
| `src/app/api/facturas-proveedor/[id]/process/route.ts`           | Modificado | Swap del import Modal→IA, guarda auditoría IA                                                    |
| `prisma/schema.prisma`                                           | Modificado | +3 columnas auditoría en `FacturaProveedor`, -`modalJobId`                                       |
| `src/app/api/productos/ocr-factura/**`, `ocr-factura-dialog.tsx` | Eliminado  | Pipeline OCR viejo sin referencias activas                                                       |
| `.env` / `.env.example`                                          | Modificado | Variables Modal → OpenRouter                                                                     |

## Riesgos

| Riesgo                                                                                | Probabilidad                                                     | Mitigación                                                                                                                                                          |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El modelo devuelve JSON que no cumple el schema esperado                              | Baja (se probó con `response_format: json_schema, strict: true`) | `validateExtractedInvoice()` rechaza antes de tocar la DB; la factura queda en `ERROR` con el mensaje                                                               |
| Reasoning tokens (`qwen/qwen3.6-35b-a3b` con `reasoning`) elevan el costo por factura | Media                                                            | `OPENROUTER_REASONING_EFFORT=low` por defecto; tokens de reasoning quedan auditados en `iaTokensUsados` para monitorear                                             |
| Migración de Prisma contra la base de producción (Railway) con drift preexistente     | Confirmada — se manejó manualmente                               | Se evitó `prisma migrate dev` (pedía reset por drift no relacionado); se escribió la migración a mano y se aplicó con `prisma migrate deploy`, que no usa shadow DB |

## Plan de Reversión (Rollback)

1. `git revert` del commit `120d196`.
2. La migración de Prisma es aditiva (columnas nullable) salvo por `modalJobId`, que no tenía datos reales — revertir el código sin revertir el schema no rompe nada; si se quiere revertir también el schema, correr una migración inversa manual.
3. Reponer las variables `MODAL_*` en Railway si se revierte el código.

## Dependencias

- Cuenta y API key de OpenRouter (`OPENROUTER_API_KEY`).
- Sin dependencias npm nuevas (usa `fetch` nativo).

## Criterios de Éxito

- [x] Una factura de prueba (PDF con texto nativo e imagen escaneada) se procesa de punta a punta sin Modal.
- [x] El costo por factura es de centavos de dólar, no de dólares (probado: ~$0.0037 en una factura de 2 items con `reasoning: low`).
- [x] `tsc --noEmit` y `npm run lint` sin errores tras el reemplazo.
- [x] Cero referencias activas al pipeline OCR viejo tras el borrado.
