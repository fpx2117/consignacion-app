# Tareas: Validación Aritmética y Refuerzo de Alineación de Filas en la Extracción de Facturas

Dos partes independientes — no hay dependencia técnica entre ellas, se pueden implementar/deployar en cualquier orden. Cada una es un PR/deploy independiente.

## Parte A: Validación aritmética (núcleo del bug)

- [x] A.1 Migración Prisma: `FacturaProveedorItem.advertencias String[] @default([])` + `prisma generate` (`20260702223000_add_factura_item_advertencias`, aplicada con `migrate deploy`)
- [x] A.2 `src/lib/ai/validar-consistencia-factura.ts` (nuevo): `validarConsistenciaFactura()` — chequeo por línea (`unitCost * quantity` vs `lineTotal`, tolerancia 1%) y chequeo de cabecera (suma de líneas vs `invoice.total`, con propagación de tope de confidence **y** advertencia visible a todas las líneas si dispara — ver nota debajo)
- [x] A.3 Tests unitarios de `validarConsistenciaFactura()` (`node:test`, mismo runner que `matching-engine.test.ts`/`normalizar-producto.test.ts` — el proyecto no usa Vitest pese a lo que decía `design.md`): caso sano, línea individual inconsistente, suma de factura inconsistente con líneas individualmente "cuadradas" (fixture con los montos reales de la factura #46), `unitCost`/`lineTotal` faltantes, tolerancia de redondeo, no-duplicación de advertencia cuando una línea falla ambos chequeos. 7/7 tests OK.
- [x] A.4 `invoice-ai-parser.ts`: `InvoiceAiItem` gana `advertencias: string[]`; `procesarFacturaConIA()` llama a `validarConsistenciaFactura()` después de `normalizarExtraccion()`, capa `confidence` por item (nunca la sube) y agrega `advertenciasFactura` al array `warnings` existente
- [x] A.5 `invoice-extraction.config.ts`: agregada la regla de autoconsistencia al prompt (`buildInvoiceExtractionPrompt()`, sección "Reglas para items") — sin tocar `buildExpectedOutputSchema()`
- [x] A.6 `process/route.ts`: persistir `advertencias` en cada `FacturaProveedorItem` dentro de `itemsData`
- [x] A.7 `src/lib/apiService.ts`: tipo `FacturaProveedorItem` incluye `advertencias: string[]`
- [x] A.8 `factura-proveedor-dialog.tsx`: indicador visual por fila (ícono `AlertTriangle` + `Tooltip` con el detalle) cuando `item.advertencias.length > 0`, independiente del badge de `matchScore` existente
- [x] A.9 Verificado contra la factura de prueba real (subida 3 veces, IDs #46/#47/#48, luego canceladas): confirmado que el warning de cabecera dispara ("La suma de los items ($X) no coincide con el total detectado ($180.700)") y que las líneas quedan con `confidence` capado a 0.5 y `advertencias` no vacío. tsc/eslint sin errores.
- [x] A.10 Cubierto por el test "factura consistente no genera ninguna advertencia" (A.3) — no se encontró una segunda factura de prueba real consistente a mano; el caso sano queda validado a nivel unitario, no e2e.

**Nota de diseño ajustada durante la implementación**: la primera versión solo propagaba el _tope de confidence_ desde el chequeo de cabecera, sin agregar una advertencia visible por línea — eso dejaba a la UI sin ninguna señal en filas cuya confianza había bajado exclusivamente por ese chequeo (el indicador de A.8 solo mira `item.advertencias`). Se corrigió `validarConsistenciaFactura()` para que la propagación también agregue una advertencia genérica por línea ("El total de la factura no coincide con la suma de los items detectados — revisar esta línea también, por las dudas"), sin duplicarla si la línea ya tenía una advertencia propia del chequeo #1. `design.md` no se actualizó con este detalle fino — queda documentado acá.

## Parte B: Reemplazo de `validateExtractedInvoice()` por Zod (mantenibilidad)

- [x] B.1 `invoice-extraction.config.ts`: definido `extractedInvoiceSchema` con `z.object(...)` (supplier, invoice, items, warnings)
- [x] B.2 `invoice-extraction.config.ts`: `validateExtractedInvoice()` reimplementada sobre `extractedInvoiceSchema.safeParse()`, misma firma y mismo tipo `InvoiceValidationResult`
- [x] B.3 Test (`invoice-extraction.config.test.ts`, `node:test`): JSON válido, objeto inválido, campo raíz faltante, tipo incorrecto en `invoice.total`, `items` no-array, `confidence` fuera de rango, `warnings` faltante — 7 casos, todos rechazados/aceptados como esperado
- [x] B.4 Test explícito de la limitación documentada: un JSON con `unitCost: 28500`/`confidence: 1` (caso real de Balbo Borgoña, monto incorrecto pero bien tipado) pasa `validateExtractedInvoice()` sin error — confirma que esta capa es independiente de la validación aritmética de la Parte A
- [x] B.5 Código de validación manual anterior (~180 líneas de `typeof` a mano) eliminado, reemplazado por el schema de Zod (~35 líneas)
- [x] B.6 tsc/eslint sin errores. 8/8 tests de este archivo OK. Verificado además end-to-end (factura de prueba #49, subida y procesada con la validación Zod en el camino real, sin regresión — cancelada después)

## Notas de secuencia

- La Parte A es la que corrige el comportamiento observado en la factura de prueba (#46) — es la prioritaria si hay que elegir con cuál empezar.
- La Parte B es refactor puro de mantenibilidad, sin cambio de comportamiento esperado — puede ir en paralelo o después, sin bloquear a la Parte A.
- Ninguna tarea de la Parte A depende de que la Parte B esté hecha (ni viceversa): `validarConsistenciaFactura()` no toca `validateExtractedInvoice()`, y el reemplazo por Zod no toca la lógica de `procesarFacturaConIA()` más allá de la función que ya llamaba.
