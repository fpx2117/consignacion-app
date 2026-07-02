# Tareas: Rubro de Negocio + Fallback Híbrido OCR/Visión para Facturas

Orden confirmado. Cada fase es un PR/deploy independiente — no hace falta completar todas para que las anteriores queden funcionando en producción.

## Fase 1: Fallback híbrido OCR + Visión

- [x] 1.1 `openrouter-client.ts`: `callOpenRouterJson()` acepta `images?: Array<{mimeType, base64}>`, arma `content` multimodal y selecciona `OPENROUTER_VISION_MODEL` cuando hay imágenes
- [x] 1.2 `ocr-engine.ts`/`extraer-texto-factura.ts`: generar `imagenParaVision` (color, comprimida con sharp, sin el grayscale de Tesseract) junto al resultado de OCR existente
- [x] 1.3 `invoice-ai-parser.ts`: lógica de `necesitaVision` (umbral `OCR_VISION_FALLBACK_THRESHOLD`), userPrompt condicional cuando se manda imagen, ajuste de `globalConfidence` sin el `Math.min` contra `confianzaOcr` cuando se usó visión
- [x] 1.4 `.env.example`: documentar `OCR_VISION_FALLBACK_THRESHOLD` (default sugerido 55) y `OPENROUTER_VISION_MODEL` (default `openai/gpt-4o-mini`)
- [x] 1.5 `openrouter-client.ts`: sumar `usedVision: boolean` al log estructurado existente
- [x] 1.6 Verificar manualmente: llamada real a OpenRouter con imagen sintética (factura sin texto OCR) confirmó extracción correcta de proveedor/items/total, `usedVision: true` en el log, modelo `openai/gpt-4o-mini`. tsc/eslint/next build sin errores.

## Fase 2: Rubro como contexto (núcleo)

- [x] 2.1 Migración Prisma: `Configuracion.rubroNegocio`, `Configuracion.columnasAtributosProducto`, `FacturaProveedorItem.atributosExtra`, `Producto.atributosExtra` + `prisma generate`
- [x] 2.2 `src/modules/invoices/config/rubros.ts` (nuevo): `RUBROS_NEGOCIO` (17 slugs + labels) y `getAtributosTipicos()` (hints por rubro)
- [x] 2.3 `invoice-extraction.config.ts`: `extraAttributes` en `ExtractedInvoiceItem`, `buildExpectedOutputSchema()`, `buildInvoiceExtractionPrompt(rubro?)`
- [x] 2.4 `invoice-ai-parser.ts`: `procesarFacturaConIA()` acepta `rubroNegocio` opcional; `normalizarExtraccion()` mapea `extraAttributes[]` a objeto plano
- [x] 2.5 `process/route.ts`: lee `Configuracion.rubroNegocio` de la sucursal de la factura antes de llamar `procesarFacturaConIA()`; persiste `atributosExtra` al crear cada `FacturaProveedorItem`
- [x] 2.6 `settings/general/route.ts`: `GET`/`PUT` incluyen `rubroNegocio`, con validación de longitud (60 caracteres)
- [x] 2.7 Página de Ajustes (`/settings/general`): campo para editar rubro post-setup
- [x] 2.8 `setup/types.ts`: `SetupFormData.rubroNegocio`, `InitializePayload.rubroNegocio`
- [x] 2.9 `BusinessStep.tsx`: selector de rubro (17 opciones + "Otro" con texto libre, maxLength 60)
- [x] 2.10 `initialize/route.ts`: persiste `rubroNegocio` en el `configuracion.upsert()` existente
- [x] 2.11 `factura-proveedor-dialog.tsx`: mostrar `atributosExtra` del item como chips de solo lectura
- [x] 2.12 `apiService.ts`/`types.ts`: tipos actualizados para `rubroNegocio` y `atributosExtra` en los payloads existentes
- [x] 2.13 Verificar manualmente: factura sintética con lote/vencimiento + rubro "farmacia" → capturados correctamente en `atributosExtra` (test real contra OpenRouter)
- [x] 2.14 Verificar manualmente: misma factura sin rubro configurado (`null`) → extracción sigue funcionando igual, atributosExtra también capturado (vía regla genérica del prompt, sin el hint de rubro). tsc/eslint/next build sin errores.

## Fase 3: `atributosExtra` genérico en `Producto`

- [x] 3.1 `validators/producto.ts`: `atributosExtra` opcional en `createProductoBaseSchema`
- [x] 3.2 `create-product/route.ts`: copia `atributosExtra` del item al `Producto` creado desde OCR
- [x] 3.3 Componente compartido `AtributosExtraEditor` (pares clave-valor, agregar/quitar fila, sugerencias vía `getAtributosTipicos` + datalist)
- [x] 3.4 `create-producto-dialog.tsx`: sección "Atributos adicionales" (colapsada por default) con `AtributosExtraEditor`
- [x] 3.5 `edit-producto-dialog.tsx`: misma sección, prellenada con el `atributosExtra` existente del producto
- [x] 3.6 Verificado contra la DB real: crear producto con atributos, actualizarlos, limpiarlos a null y borrar — los 3 pasos persisten correctamente (incluyó fix de `Prisma.JsonNull` para el caso update-a-null, que TS marcaba como error de tipos en `/api/productos/[id]`). tsc/eslint/next build sin errores.

## Fase 4: Columnas dinámicas en la tabla de productos

- [x] 4.1 `productos-view.tsx`: extender `SortKey` para aceptar `attr:{clave}` + branch en el comparador de `sorted`
- [x] 4.2 `productos-view.tsx`: renderizar `TableHead`/`TableCell` dinámicos desde `columnasAtributosProducto`
- [x] 4.3 `columnas-producto-picker.tsx` (nuevo): popover con checkboxes — candidatas = claves en uso en `statsItems` (catálogo completo, no solo la página) + sugeridas por rubro
- [x] 4.4 Persistencia del picker vía `PUT /api/settings/general` (`columnasAtributosProducto`), con update optimista en la UI
- [x] 4.5 `MobileProductCard`: renderizar las mismas columnas activas como badges (solo si el producto tiene valor para esa clave)
- [x] 4.6 Verificado contra la DB real: `Configuracion.columnasAtributosProducto` persiste correctamente (`[]` → `["talle","color"]` → revertido). tsc/eslint/next build sin errores. La verificación visual completa (picker + tabla + badges mobile) queda pendiente de probar en la UI real por el usuario.
