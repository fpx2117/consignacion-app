# Propuesta: Validación Aritmética y Refuerzo de Alineación de Filas en la Extracción de Facturas

## Intención

Se probó el pipeline de OCR + IA (`extraerTextoFactura` → `procesarFacturaConIA` → `matchearItem`) con una factura real (foto de celular, papel de impresora matricial, 10 líneas, ver factura de prueba #46). Resultado:

- Encabezado (proveedor, CUIT, total general) se leyó correctamente.
- **4 de 10 líneas de producto quedaron con precio o cantidad equivocados**, y el patrón de error es siempre el mismo: un valor de una fila "se corrió" a otra fila cercana.
  - `MANAOS COLA 6x2,25` tiene cantidad **3** en la factura (marcada a mano con tilde) → se extrajo cantidad 1, perdiendo $16.600 de esa línea.
  - `BALDO BORGOÑA` (precio real $13.900) quedó con el precio de `COCA-COLA` ($28.500).
  - `COCA-COLA` (precio real $28.500, cantidad 1) quedó con cantidad 2 y `lineTotal` $57.000, duplicando el precio que le "robó" a Balbo Borgoña.
  - El código de proveedor de `BAGGIO` (253 en la factura) se completó con el código de `LATA ISENBECK` (574).
- **La suma de los `lineTotal` devueltos por la IA da $210.700, pero `invoice.total` (leído correctamente del renglón TOTAL) es $180.700** — una diferencia de $30.000 que es matemáticamente detectable sin volver a leer la imagen, y sin embargo el item quedó con `confidence: 1` en las 10 líneas y la factura no generó ningún warning.
- Ningún item hizo match automático con el catálogo (`matchScore` 0.16–0.37, todos por debajo de `UMBRAL_REVISION = 0.70` en `matching-engine.ts:40`) — evidencia consistente con que el negocio de prueba no tenía catálogo cargado para esos productos, no un problema de esta propuesta.

El pipeline ya le pide al modelo, por prompt, que se autoevalúe (`invoice-extraction.config.ts:530`: _"Si el total no coincide con la suma visible de items, agregá warning y no corrijas el total"_) y que reporte `confidence` por línea. En la práctica, con `gpt-4o-mini`, el modelo no está aplicando esa autoevaluación de forma confiable: devolvió `confidence: 1` y `warnings: []` en una extracción que un chequeo aritmético de una línea de código detecta al instante. Confiar únicamente en que el modelo se autoevalúe bien es la causa raíz — hoy no hay ninguna capa determinística que verifique lo que el modelo devuelve.

## Alcance

### Dentro del Alcance

1. **Validación aritmética post-extracción, determinística, en código (no en el prompt)** — nueva función en `invoice-ai-parser.ts` (o un módulo nuevo `src/lib/ai/validar-consistencia-factura.ts`) que corre después de `normalizarExtraccion()` y antes de devolver el resultado:
   - Por línea: si `unitCost`, `quantity` y `lineTotal` están los tres presentes y `unitCost * quantity` difiere de `lineTotal` más de una tolerancia (ej. 1%, para redondeos), se agrega un warning específico de esa línea y se **capa la `confidence` de esa línea** (nunca se sube, solo se puede bajar) a un máximo de, por ejemplo, 0.5 — sin importar lo que haya devuelto el modelo.
   - A nivel factura: si `invoice.total` está presente y la suma de `lineTotal` (o `unitCost * quantity` cuando falte `lineTotal`) difiere más de una tolerancia, se agrega un warning de factura ("La suma de los items ($X) no coincide con el total detectado ($Y)") — esto ya existía como instrucción de prompt, pasa a ser un chequeo real.
   - Esta validación **nunca modifica los valores extraídos** (no "corrige" precios ni cantidades) — solo ajusta `confidence` y agrega texto a `warnings`, que son señales, no datos. La corrección de datos sigue siendo 100% responsabilidad del usuario en la UI de revisión (esto no cambia el principio de "nada actualiza stock hasta que el usuario aprueba", ya vigente en `factura-proveedor-dialog.tsx:651`).
2. **Refuerzo del prompt para reducir el error de raíz (fila desalineada), no solo detectarlo después**: agregar una instrucción explícita en `buildInvoiceExtractionPrompt()` pidiendo que, para cada línea, el modelo verifique internamente `unitCost * quantity ≈ lineTotal` antes de responder, y que si no coincide, prefiera bajar su propia `confidence` en vez de inventar un valor que sí cierre la cuenta. Esto es una instrucción adicional, no reemplaza el chequeo determinístico del punto 1 — el prompt ya pedía algo parecido a nivel factura (línea 530) y no fue suficiente por sí solo, así que se lo baja a nivel línea, que es donde ocurrió el error real.
3. **UI de revisión (`factura-proveedor-dialog.tsx`)**: las líneas con warning de inconsistencia aritmética se muestran con un indicador visual distinto (ej. mismo ícono `AlertTriangle` que ya se usa para el banner general, pero por fila) y un tooltip con el motivo concreto ("Cantidad × precio unitario no coincide con el total de línea"). No cambia el flujo de confirmación, solo hace más visible cuál línea mirar primero — hoy las 10 líneas se ven visualmente iguales salvo por el badge de coincidencia de producto, que es una señal distinta (viene de `matching-engine.ts`, no de la calidad de la extracción).
4. **Persistir los warnings de línea en `FacturaProveedorItem`**: se reusa el array `warnings` que ya devuelve `procesarFacturaConIA()` a nivel factura (`InvoiceAiSuccessResult.warnings`), pero se necesita poder asociar un warning a una línea puntual — se agrega `advertencias: string[]` (o similar) a `InvoiceAiItem` y a la persistencia en `process/route.ts`, en vez de un array plano a nivel factura que no dice a qué línea corresponde.
5. **Mejora de mantenibilidad (secundaria, no resuelve el bug): reemplazar `validateExtractedInvoice()` por un schema de Zod.** Hoy esa función (`invoice-extraction.config.ts`, ~180 líneas) valida a mano campo por campo con `typeof`. Zod ya es dependencia del proyecto (`package.json`, `^4.3.6`) y se usa en otros validators (`src/lib/validators/producto.ts`). Reemplazarla por un `z.object(...)` declarativo:
   - reduce código repetitivo y centraliza en un solo lugar la forma esperada del JSON que devuelve la IA;
   - da mensajes de error más claros (`error.issues`) que la lista de strings armada a mano actual;
   - facilita agregar un campo nuevo al schema esperado sin tocar 5 bloques de `if` distintos.

   **Importante — qué NO resuelve este punto**: Zod valida _forma y tipos_ (¿es `unitCost` un `number`? ¿está `supplier.name` presente?), no _contenido correcto_. Un JSON con `unitCost: 28500` en la línea de Balbo Borgoña (cuando el papel dice 13900) pasa un schema de Zod sin ningún error, porque `28500` es un `number` válido — exactamente el error que se vio en la prueba. Por eso este punto es una capa de validación **estructural**, independiente y subordinada a la validación **aritmética** de los puntos 1-2 (que es la que ataca la causa real del bug). No se debe mezclar una cosa con la otra: Zod ordena la entrada/salida del parser, la validación aritmética mejora la confiabilidad real de los datos extraídos.

### Orden de implementación sugerido

1. Mantener el pipeline actual tal cual está: Sharp (preprocesamiento) + Tesseract (OCR local barato) + OpenRouter con fallback de visión. No es un rediseño, es una capa nueva sobre lo que ya funciona.
2. No tocar la rasterización de PDF (Puppeteer/Chromium) ni migrar de OpenRouter al SDK de OpenAI directo — ver "Fuera del Alcance" para el porqué de cada uno.
3. Punto 1 del alcance: validación aritmética por línea (`unitCost * quantity` vs `lineTotal`).
4. Punto 1 del alcance: validación de consistencia a nivel factura (suma de líneas vs `invoice.total`).
5. Punto 1 del alcance: bajar `confidence` cuando los montos no cierran (nunca subirla, nunca reescribir el valor).
6. Punto 3 del alcance: marcar visualmente en la UI los items dudosos para revisión humana.
7. Punto 2 del alcance: refuerzo del prompt (mitigación de causa raíz, complementaria).
8. Punto 5 del alcance: reemplazo de `validateExtractedInvoice()` por Zod — mejora de mantenibilidad, se hace al final porque no bloquea ni afecta a los puntos 3-7.

### Fuera del Alcance

- **Reintento automático o segunda pasada de IA cuando la validación aritmética falla.** Se decidió no encadenar más llamados a OpenRouter por línea con inconsistencia — mismo criterio ya aplicado en `rubro-contexto-ocr` (Decisión 5: "no se encadenan más llamados, se reporta como advertencia/revisión manual"). Esta propuesta es consistente con esa decisión previa, no la reabre.
- **Corregir automáticamente el valor sospechoso** (ej. recalcular `unitCost` desde `lineTotal / quantity` cuando no calzan). Explícitamente rechazado: el prompt ya prohíbe esto (`invoice-extraction.config.ts:507-508`, "No calcules unitCost desde lineTotal/quantity") porque no hay forma de saber, sin ver de nuevo la imagen, _cuál_ de los tres valores es el que está mal — podría ser cualquiera de los tres. Auto-corregir arriesga reemplazar un dato leído mal por uno inventado con más confianza aparente.
- **Cambiar de modelo o forzar visión siempre.** La imagen de prueba sí incluía fallback de visión (`necesitaVision: true`, es una foto) y el error ocurrió _con_ la imagen disponible — el problema no es falta de visión, es que el modelo no aplicó su propia regla de autoconsistencia. Cambiar de modelo es una variable costosa de aislar sin datos de varias facturas; esta propuesta prioriza una mitigación determinística que funciona sin importar qué modelo esté configurado en `OPENROUTER_MODEL`/`OPENROUTER_VISION_MODEL`.
- **Mejoras al motor de matching (`matching-engine.ts`) o a los umbrales de `UMBRAL_SEGURA`/`UMBRAL_PROBABLE`.** El resultado "SIN_COINCIDENCIA" en las 10 líneas de la prueba es esperable (catálogo de prueba sin esos productos cargados) y no es un síntoma del mismo problema — queda fuera de esta propuesta.
- **Reprocesar automáticamente facturas ya cargadas con esta validación.** Solo aplica a facturas procesadas después del cambio; no hay backfill de `FacturaProveedor` existentes.
- **Mejoras de preprocesamiento de imagen** (deskew, binarización adaptativa para papel de impresora matricial con pliegues/sombras como el de la prueba). Es una causa raíz plausible del error de alineación, pero requiere probar con un corpus de facturas real para no arriesgar una regresión silenciosa en el 90% de los casos que hoy funcionan bien — se deja como candidato a un cambio propio, posterior, una vez que el logging de este cambio (warnings persistidos) dé visibilidad de cuán seguido pasa esto en producción.

## Enfoque

### Decisión 1: la validación es una capa determinística en código, no una instrucción de prompt más fuerte

**Elección**: función pura en TypeScript que recibe `ExtractedInvoiceData` ya normalizado y devuelve advertencias + ajustes de confidence, sin volver a llamar a OpenRouter.

**Alternativas consideradas**:

- Reforzar solo el prompt (punto 2 del alcance) y esperar que alcance.
- Pedirle al modelo que devuelva un campo booleano `sumaVerificada` por línea, confiando en que lo calcule bien.

**Justificación**: el caso de prueba ya demuestra que pedirle al modelo que se autoevalúe no es confiable — la instrucción de "avisá si no coincide" ya existía a nivel factura (línea 530 del prompt actual) y el modelo devolvió `confidence: 1` en las 10 líneas de una factura con un desfasaje de $30.000 detectable con una multiplicación. Una multiplicación y una resta son baratas y 100% confiables en código; no tiene sentido delegarlas a un LLM. El refuerzo de prompt (punto 2) se mantiene en el alcance como mitigación complementaria de la causa raíz (mejor alineación en el momento de leer), pero la validación de código es la que garantiza que el usuario vea la señal aunque el modelo la pase por alto.

### Decisión 2: la validación ajusta `confidence` y agrega `warnings`, nunca reescribe `unitCost`/`quantity`/`lineTotal`

**Elección**: los tres campos numéricos que devuelve la IA llegan intactos a la UI, incluso si no pasan la validación.

**Alternativas consideradas**:

- Poner el campo en `null` automáticamente si no pasa la validación, forzando al usuario a completarlo a mano.
- Recalcular el valor más "sospechoso" de los tres.

**Justificación**: mismo principio que ya rige todo el pipeline ("nada actualiza stock hasta que el usuario aprueba" — `factura-proveedor-dialog.tsx:651`). Poner en `null` un valor que sí es correcto (ej. si el error real está en `quantity` pero el chequeo no puede saber cuál de los tres es el culpable) le hace perder al usuario un dato que sí tenía, cuando alcanza con avisarle "revisá esta línea" y dejar que decida con la factura en la mano.

### Decisión 3: umbral de tolerancia configurable, no hardcodeado al 0%

**Elección**: constante `TOLERANCIA_CONSISTENCIA_ARITMETICA = 0.01` (1%) en el nuevo módulo, ajustable sin tocar lógica.

**Alternativas consideradas**:

- Igualdad exacta (`unitCost * quantity === lineTotal`).

**Justificación**: facturas reales redondean (ej. IVA discriminado, centavos truncados) — exigir igualdad exacta generaría falsos positivos en líneas que sí están bien leídas, entrenando al usuario a ignorar la advertencia. Un margen chico filtra el ruido de redondeo sin dejar pasar errores de la magnitud vista en la prueba (diferencias de miles de pesos, muy por encima de cualquier redondeo real).

## Áreas Afectadas

| Área                                                              | Impacto                     | Descripción                                                                                                                                                                                                      |
| ----------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/ai/validar-consistencia-factura.ts`                      | Nuevo                       | Validación determinística: por línea (`unitCost * quantity` vs `lineTotal`) y por factura (suma de líneas vs `invoice.total`); devuelve warnings + ajustes de confidence, no muta valores numéricos              |
| `src/lib/ai/invoice-ai-parser.ts`                                 | Modificado                  | `procesarFacturaConIA()` llama a la validación después de `normalizarExtraccion()`, antes de devolver `InvoiceAiSuccessResult`; `InvoiceAiItem` gana `advertencias: string[]`                                    |
| `src/modules/invoices/config/invoice-extraction.config.ts`        | Modificado                  | `buildInvoiceExtractionPrompt()` suma una regla explícita de autoconsistencia por línea (`unitCost * quantity ≈ lineTotal`) antes de responder                                                                   |
| `src/app/api/facturas-proveedor/[id]/process/route.ts`            | Modificado                  | Persiste `advertencias` de cada item al crear el `FacturaProveedorItem`                                                                                                                                          |
| `prisma/schema.prisma`                                            | Modificado                  | `FacturaProveedorItem.advertencias String[] @default([])` (o `Json?` si se prefiere estructura, a definir en `design.md`)                                                                                        |
| `prisma/migrations/`                                              | Nuevo                       | Migración aditiva, columna nullable/con default vacío                                                                                                                                                            |
| `src/app/(...)/productos/components/factura-proveedor-dialog.tsx` | Modificado                  | Indicador visual por fila cuando `advertencias.length > 0`, con tooltip del motivo                                                                                                                               |
| `src/lib/apiService.ts`                                           | Modificado                  | Tipo `FacturaProveedorItem` incluye `advertencias: string[]`                                                                                                                                                     |
| `src/modules/invoices/config/invoice-extraction.config.ts`        | Modificado (mantenibilidad) | `validateExtractedInvoice()` se reemplaza por un schema `z.object(...)`; `InvoiceValidationResult` pasa a derivarse de `result.success`/`result.error.issues` de Zod en vez de un array de strings armado a mano |

## Riesgos

| Riesgo                                                                                                                                            | Probabilidad | Mitigación                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Falsos positivos por redondeo bajan confidence de líneas que en realidad están bien leídas                                                        | Media        | Tolerancia configurable (Decisión 3), calibrable con casos reales antes de bajar el default                                                                                                    |
| El refuerzo de prompt (punto 2) no reduce la tasa de error real del modelo                                                                        | Media        | Es complementario, no la mitigación principal — la validación determinística (punto 1) es la que garantiza la señal al usuario incluso si el prompt no mejora nada                             |
| Agregar una columna nueva a `FacturaProveedorItem` requiere tocar varios puntos de escritura (`process/route.ts`, posibles otros que creen items) | Baja         | Es aditiva con default `[]`, no rompe código existente que no la usa                                                                                                                           |
| El usuario empieza a ignorar el indicador si aparece en casi todas las facturas (alerta fatigue)                                                  | Media        | Tolerancia calibrada para que solo dispare ante desfasajes grandes (no de centavos); si en producción dispara demasiado seguido, es señal para revisar el umbral, no para quitar la validación |

## Plan de Reversión (Rollback)

1. **Código**: `git revert` de los commits del cambio. Sin la validación, el pipeline vuelve exactamente al comportamiento actual (confía 100% en `confidence`/`warnings` del modelo).
2. **Base de datos**: columna nueva nullable/con default — reversible con `DROP COLUMN` si hiciera falta, sin afectar el resto del schema.

## Dependencias

- Ninguna dependencia externa nueva. Solo TypeScript puro para la validación aritmética.

## Criterios de Éxito

- [ ] Reprocesando la factura de prueba (10 items, desfasaje de $30.000 conocido), al menos las líneas de `BALDO BORGOÑA`, `COCA-COLA` y `MANAOS COLA` quedan con `confidence` bajado y un warning propio, en vez de `confidence: 1` sin avisos.
- [ ] La factura de prueba genera un warning a nivel cabecera indicando que la suma de líneas no coincide con `totalDetectado`.
- [ ] Una factura donde la suma de líneas sí coincide con el total (dentro de la tolerancia) no genera ningún warning nuevo — cero falsos positivos en el caso sano.
- [ ] `unitCost`, `quantity` y `lineTotal` extraídos por la IA llegan sin modificar a la UI, incluso en líneas con warning — la validación nunca sobrescribe un valor.
- [ ] La UI muestra el indicador de inconsistencia por fila, distinguible del badge de coincidencia de producto (son señales independientes).
- [ ] El umbral de tolerancia es una constante ajustable en un solo lugar, no un número repetido en varios archivos.
- [ ] `validateExtractedInvoice()` queda reemplazada por un schema de Zod, con el mismo comportamiento observable (rechaza los mismos JSON inválidos que antes) — cero cambio funcional, solo de implementación.
- [ ] Un JSON con tipos correctos pero montos incorrectos (ej. `unitCost` como `number` válido pero desalineado con el papel) pasa la validación de Zod sin error — confirma que Zod y la validación aritmética son capas independientes, no una sustituyendo a la otra.
