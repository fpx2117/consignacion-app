# Diseño: Migración del motor de extracción IA de facturas de Modal a OpenRouter

## Enfoque técnico

El único componente que cambia es _cómo se estructura el texto de la factura en JSON_. Todo lo que ocurre antes (subida, extracción de texto) y después (matching contra el catálogo, aprendizaje de alias, confirmación, stock/costo) es infraestructura ya existente y no se modificó.

Decisión central: **a la IA sólo le llega texto plano, nunca el archivo original.** Esto es lo que hace que el costo sea por tokens (centavos) y no por tiempo de GPU encendida (dólares). La extracción de ese texto es 100% local/CPU (pdf-parse o Tesseract.js), corre en el mismo proceso de Next.js, y no depende de ningún servicio externo.

## Decisiones de arquitectura

### Decisión: enviar sólo texto a la IA, nunca imágenes/PDF

**Elección**: extraer texto localmente primero (`extraerTextoFactura()`) y mandar ese texto a OpenRouter. El modelo nunca ve el archivo original.

**Alternativas consideradas**:

- Mandar la imagen/PDF directo a un modelo de visión en OpenRouter (como se hacía con Modal + Qwen VL).
- Mandar imagen sólo cuando el texto extraído localmente resulta insuficiente (híbrido).

**Justificación**: los modelos de visión cobran significativamente más por request (tokens de imagen) que un modelo de texto con el mismo texto ya extraído. Como el 90% de las facturas son PDF con texto nativo o se resuelven bien con Tesseract, mandar sólo texto cubre el caso común al costo mínimo. El híbrido queda como posible mejora futura si se detecta que Tesseract falla seguido en facturas específicas.

---

### Decisión: prompt y JSON schema generados desde una config declarativa, no hardcodeados

**Elección**: `invoice-extraction.config.ts` define los campos esperados (clave, alias, tipo, descripción) y dos funciones (`buildInvoiceExtractionPrompt`, `buildExpectedOutputSchema`) arman el prompt y el `response_format.json_schema` a partir de esa config.

**Alternativas consideradas**:

- Prompt fijo en un string largo dentro del cliente HTTP (como estaba en `modal/ocr-client.ts`).
- Tipo `ExtractedInvoiceData` completo y genérico multi-rubro (impuestos desglosados, descuentos, lote, vencimiento, `itemType`), independiente del schema Prisma actual.

**Justificación**: un prompt hardcodeado requiere tocar texto libre cada vez que se agrega/ajusta un campo. La config declarativa lo hace mecánico. Se descartó el tipo `ExtractedInvoiceData` completo porque el schema de `FacturaProveedor`/`FacturaProveedorItem` no tiene columnas para impuestos por línea, descuentos, lote o vencimiento — modelar esos campos en la config sin poder persistirlos sería dato muerto. Si se necesitan a futuro, primero se extiende el schema Prisma y después la config.

---

### Decisión: migración de Prisma escrita a mano, aplicada con `migrate deploy` en vez de `migrate dev`

**Elección**: ante drift preexistente en la base de Railway (columnas ya presentes que no coincidían con el historial de migraciones, no relacionado a este cambio), se escribió el archivo SQL de la migración manualmente y se aplicó con `prisma migrate deploy`.

**Alternativas consideradas**:

- Correr `prisma migrate dev`, que pedía resetear todo el schema `public` por el drift.
- Ignorar el drift y forzar el reset.

**Justificación**: `migrate dev` usa una shadow database para diffear y por eso exige resolver el drift primero (con reset, destructivo). `migrate deploy` sólo aplica migraciones pendientes registradas en `_prisma_migrations`, sin diffear contra el estado real — es el camino seguro para producción cuando ya se sabe exactamente qué SQL aditivo hace falta.

## Flujo de control objetivo

### Flujo completo: subida de factura → revisión

```text
Usuario sube archivo (PDF/JPG/PNG) desde FacturaProveedorDialog
    -> POST /api/facturas-proveedor/upload
        -> requireAuth() + requireRole(ADMIN)
        -> validateUploadCandidate() (tamaño, extensión, MIME, firma binaria)
        -> guarda en storage/facturas-proveedor/ (fuera de public/, nunca servido estático)
        -> crea FacturaProveedor { estado: PENDIENTE, sucursalId }
    -> [sin llamadas a IA todavía]

Usuario dispara el procesamiento
    -> POST /api/facturas-proveedor/[id]/process
        -> valida permisos + pertenencia a sucursal + estado procesable (PENDIENTE|ERROR)
        -> marca FacturaProveedor.estado = PROCESANDO
        -> lee el archivo del disco (readFile)
        -> procesarFacturaConIA({ buffer, mimeType })  [src/lib/ai/invoice-ai-parser.ts]

            -> extraerTextoFactura({ buffer, mimeType })  [src/lib/ocr/extraer-texto-factura.ts]
                -> si es PDF con texto nativo: extraerTextoPdf() (pdf-parse, sin Chromium)
                -> si es PDF escaneado: rasterizarPdf() (Chromium) + recognizeImage() (Tesseract)
                -> si es imagen: preprocesarImagen() (sharp) + recognizeImage() (Tesseract)
                <- { texto, confianzaOcr }

            -> truncateOcrText(texto)  [invoice-extraction.config.ts, tope OPENROUTER_MAX_INPUT_CHARS]
            -> buildInvoiceExtractionPrompt() + buildExpectedOutputSchema()
                [config declarativa de campos -> prompt + JSON schema, nada hardcodeado]

            -> callOpenRouterJson({ systemPrompt, userPrompt, jsonSchema })
                [src/lib/ai/openrouter-client.ts]
                -> POST https://openrouter.ai/api/v1/chat/completions
                   Authorization: Bearer OPENROUTER_API_KEY
                   model: OPENROUTER_MODEL (qwen/qwen3.6-35b-a3b)
                   reasoning: { effort: OPENROUTER_REASONING_EFFORT }
                   response_format: { type: json_schema, schema, strict: true }
                   timeout: OCR_TIMEOUT_MS (AbortController)
                <- { content: JSON string, usage: { tokens..., reasoningTokens } }

            -> parseJsonContent(content) + validateExtractedInvoice(parsed)
                -> si no valida: status "error", no se persiste nada
            -> calculateInvoiceConfidence(datos) -> confianza global
            <- InvoiceAiResult { supplier, invoice, items, warnings, globalConfidence, aiModel, aiUsage, aiRawResponse }

        -> [de vuelta en process/route.ts]
        -> construirContextoMatching({ sucursalId, proveedorId })  [matching-engine.ts]
        -> por cada item: matchearItem() -> alias exacto > nombre exacto > fuzzy (Dice)
        -> transacción Prisma:
            - FacturaProveedor.estado = REQUIERE_REVISION
            - guarda proveedorNombreDetectado/CuitDetectado, numeroFactura, fecha, moneda, total
            - guarda confianzaOcr, iaRespuestaCruda, iaModeloUsado, iaTokensUsados (auditoría)
            - crea FacturaProveedorItem por cada item, con su match/score/estado
        -> [ningún match, por más "seguro", toca stock o costo todavía]

Usuario revisa en la UI (FacturaProveedorDialog)
    -> ve proveedor sugerido, items con score de match, alternativas
    -> confirma / corrige / crea producto nuevo
    -> POST /api/facturas-proveedor/items/[id]/confirm (u otros endpoints de items/*)
        -> recién acá: aplicarMovimientoStock() + registrarCostoYAlias()
        -> guarda ProductoProveedorAlias (aprendizaje para la próxima factura de este proveedor)
```

Regla clave: **ninguna llamada a la IA recibe el archivo original** — sólo el texto ya extraído localmente. Y **ningún resultado de la IA, por alta que sea su confianza, escribe stock o costo directamente** — eso ocurre únicamente en el paso de confirmación manual del usuario.
