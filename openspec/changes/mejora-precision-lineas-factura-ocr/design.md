# Diseño: Validación Aritmética y Refuerzo de Alineación de Filas en la Extracción de Facturas

## Análisis de la arquitectura actual (evidencia con file:line)

Flujo confirmado: `upload/route.ts` (sube y crea `FacturaProveedor` en `PENDIENTE`) → `[id]/process/route.ts` (dispara todo) → `extraerTextoFactura()` → `procesarFacturaConIA()` (`src/lib/ai/invoice-ai-parser.ts:82-161`, arma prompt + schema desde `invoice-extraction.config.ts`, llama OpenRouter) → `normalizarExtraccion()` (mismo archivo, líneas 163-205) → de vuelta en `process/route.ts`, se corre `matchearItem()` por item y se persiste todo en una sola transacción (`process/route.ts:143-177`, `createMany` para los items).

Puntos verificados en el código, relevantes para este cambio:

- `normalizarExtraccion()` (`invoice-ai-parser.ts:163`) hoy solo tipa/sanitiza (`typeof === "number"`, trim de strings) — no hay ningún cruce entre `unitCost`, `quantity` y `lineTotal` de una misma línea, ni entre la suma de líneas y `invoice.total`. La validación aritmética de esta propuesta se inserta **después** de esta función, sobre su resultado ya tipado (`ExtractedInvoiceData & { ocrTextRaw: string }`).
- `calculateInvoiceConfidence()` (`invoice-extraction.config.ts:882-941`) calcula la confianza global promediando confianza de cabecera + promedio de `item.confidence` — pero `item.confidence` es el valor que **el propio modelo reportó**, nunca verificado contra los otros campos de la misma línea. En la prueba real (factura #46), el modelo devolvió `confidence: 1` en las 10 líneas, 4 de ellas con datos incorrectos — confirma que este campo, tal cual existe hoy, no es una señal confiable por sí sola.
- `InvoiceAiItem` (`invoice-ai-parser.ts:45-55`) y la persistencia en `process/route.ts:122-137` no tienen ningún campo para advertencias a nivel de línea — el único array de `warnings` que existe hoy (`InvoiceAiSuccessResult.warnings`, `invoice-ai-parser.ts:63`) es a nivel factura completa, generado por el modelo, y tampoco se persiste hoy en ninguna columna de `FacturaProveedor` (se devuelve en la respuesta HTTP de `process/route.ts:182` pero se pierde — no hay columna `warnings` en el modelo `FacturaProveedor`).
- `validateExtractedInvoice()` (`invoice-extraction.config.ts:690-867`, ~180 líneas) es la única validación que corre antes de confiar en el JSON del modelo — valida forma/tipos a mano, sin usar la dependencia `zod` que el proyecto ya tiene instalada (`package.json`, `^4.3.6`) y usa en otros validators (`src/lib/validators/producto.ts`).
- `FacturaProveedorItem` (`prisma/schema.prisma:795-821`) ya tiene el patrón de columna `Json?` para datos flexibles por línea (`atributosExtra`, agregado en el cambio `rubro-contexto-ocr`) — el campo nuevo de esta propuesta (`advertencias`) sigue el mismo patrón de columna aditiva ya validado en producción.
- `factura-proveedor-dialog.tsx` (`badgeEstado()`, líneas 49-68) ya tiene un sistema de badges por estado de matching (`COINCIDENCIA_SEGURA`, `REQUIERE_REVISION`, etc.) — es una señal _distinta_ a la que agrega esta propuesta: `matchScore` mide "¿este texto se parece a un producto de mi catálogo?", mientras que la validación aritmética mide "¿estos tres números de esta misma línea son consistentes entre sí?". Son ortogonales; un item puede tener `COINCIDENCIA_SEGURA` de producto y aun así tener un precio mal leído.

## Caso de prueba de referencia (factura #46)

Datos reales usados para calibrar la tolerancia y como fixture de test:

| Línea                | Cantidad real | Precio unit. real | Total real | Extraído por IA                        | Debería disparar                                                                                                                                                                                 |
| -------------------- | ------------- | ----------------- | ---------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| MANAOS COLA 6x2,25   | 3             | 8300              | 24900      | qty=1, unitCost=8300, lineTotal=8300   | `unitCost*quantity` (8300) coincide con `lineTotal` (8300) → **no dispara por línea** (el error es de `quantity`, no de consistencia interna de esa línea — ver "Limitación conocida" más abajo) |
| BALDO BORGOÑA        | 1             | 13900             | 13900      | qty=1, unitCost=28500, lineTotal=28500 | `unitCost*quantity` (28500) coincide con `lineTotal` (28500) → **no dispara por línea tampoco** (mismo motivo)                                                                                   |
| COCA-COLA            | 1             | 28500             | 28500      | qty=2, unitCost=28500, lineTotal=57000 | `unitCost*quantity` = 57000 = `lineTotal` → **no dispara por línea**                                                                                                                             |
| — (factura completa) | —             | —                 | 180700     | suma de `lineTotal` = 210700           | **sí dispara** — desfasaje de $30.000 contra `invoice.total`                                                                                                                                     |

Esto es un hallazgo importante para el diseño, no solo un detalle: **la mayoría de los errores de esta factura de prueba son internamente consistentes por línea** (el modelo multiplicó bien `unitCost * quantity = lineTotal` en cada una) — el error real es que agarró el precio/cantidad de la fila vecina. La validación por línea (`unitCost*quantity` vs `lineTotal`) por sí sola **no habría detectado 3 de los 4 errores** de este caso concreto. Lo que sí lo detecta es la validación a **nivel factura** (suma de líneas vs `invoice.total`), que es la que efectivamente disparó en la prueba real. Se documenta esto explícitamente para no sobrevender el punto 1a del alcance: es una red de seguridad genérica (útil para otros patrones de error, ej. una IA que sí calcula mal una multiplicación), pero en este caso puntual la señal fuerte es la de cabecera.

Consecuencia de diseño: cuando la validación de cabecera dispara (suma ≠ total) pero **ninguna línea individual** falla su propio chequeo interno, el warning de cabecera debe igual bajar la confianza de **todas las líneas de la factura** (no se puede saber cuál de las N líneas es la culpable sin volver a mirar la imagen) — no solo emitir un warning "flotante" a nivel factura que el usuario puede pasar por alto. Ver sección "Propagación cabecera → líneas" más abajo.

## Módulo nuevo: `validar-consistencia-factura.ts`

```typescript
// src/lib/ai/validar-consistencia-factura.ts

export const TOLERANCIA_CONSISTENCIA_ARITMETICA = 0.01; // 1%, ajustable
export const CONFIDENCE_MAXIMA_SI_INCONSISTENTE = 0.5;

export type AdvertenciaLinea = {
  index: number; // posición en el array de items, para poder mapear 1:1 al crear FacturaProveedorItem
  mensaje: string;
};

export type ResultadoValidacionConsistencia = {
  itemsConAdvertencia: Map<number, string[]>; // index -> advertencias de esa línea
  advertenciasFactura: string[]; // agregadas a ExtractedInvoiceData.warnings existente
  confidenceMaximaPorItem: Map<number, number>; // index -> tope de confidence (solo si hubo inconsistencia)
};

export function validarConsistenciaFactura(
  datos: ExtractedInvoiceData,
): ResultadoValidacionConsistencia {
  const itemsConAdvertencia = new Map<number, string[]>();
  const confidenceMaximaPorItem = new Map<number, number>();
  const advertenciasFactura: string[] = [];

  // 1. Por línea: unitCost * quantity vs lineTotal
  datos.items.forEach((item, index) => {
    if (item.unitCost == null || item.lineTotal == null) return; // no hay suficiente dato para comparar
    const esperado = item.unitCost * item.quantity;
    const diferencia = Math.abs(esperado - item.lineTotal);
    const tolerancia =
      Math.max(esperado, item.lineTotal) * TOLERANCIA_CONSISTENCIA_ARITMETICA;
    if (diferencia > tolerancia) {
      agregar(
        itemsConAdvertencia,
        index,
        `Cantidad × precio unitario (${esperado}) no coincide con el total de línea (${item.lineTotal})`,
      );
      confidenceMaximaPorItem.set(index, CONFIDENCE_MAXIMA_SI_INCONSISTENTE);
    }
  });

  // 2. A nivel factura: suma de líneas vs invoice.total
  if (datos.invoice.total != null) {
    const sumaLineas = datos.items.reduce((acc, item) => {
      const valor =
        item.lineTotal ??
        (item.unitCost != null ? item.unitCost * item.quantity : 0);
      return acc + valor;
    }, 0);
    const diferencia = Math.abs(sumaLineas - datos.invoice.total);
    const tolerancia =
      Math.max(sumaLineas, datos.invoice.total) *
      TOLERANCIA_CONSISTENCIA_ARITMETICA;
    if (diferencia > tolerancia) {
      advertenciasFactura.push(
        `La suma de los items ($${sumaLineas.toLocaleString("es-AR")}) no coincide con el total detectado ($${datos.invoice.total.toLocaleString("es-AR")})`,
      );
      // Propagación cabecera -> líneas: no se puede saber cuál línea es la culpable,
      // así que se capa la confidence de TODAS las líneas que no tengan ya un tope
      // más estricto puesto por el chequeo #1.
      datos.items.forEach((_, index) => {
        if (!confidenceMaximaPorItem.has(index)) {
          confidenceMaximaPorItem.set(
            index,
            CONFIDENCE_MAXIMA_SI_INCONSISTENTE,
          );
        }
      });
    }
  }

  return { itemsConAdvertencia, advertenciasFactura, confidenceMaximaPorItem };
}

function agregar(mapa: Map<number, string[]>, index: number, mensaje: string) {
  const actual = mapa.get(index) ?? [];
  actual.push(mensaje);
  mapa.set(index, actual);
}
```

Función pura, sin I/O, sin llamadas a OpenRouter — testeable con Vitest igual que `matching-engine.test.ts`/`normalizar-producto.test.ts` que ya existen en `src/lib/ocr/`.

## Integración en `invoice-ai-parser.ts`

Diff conceptual sobre `procesarFacturaConIA()` (líneas 126-160 actuales):

```typescript
const datos = normalizarExtraccion(parsed as Record<string, unknown>, texto);

// NUEVO: validación determinística, después de normalizar, antes de armar la respuesta.
const consistencia = validarConsistenciaFactura(datos);

const globalConfidence = necesitaVision
  ? calculateInvoiceConfidence(datos)
  : Math.min(calculateInvoiceConfidence(datos), confianzaOcr / 100);

return {
  status: "success",
  ocrText: texto,
  supplier: datos.supplier,
  invoice: datos.invoice,
  items: datos.items.map((item, index) => {
    const advertenciasLinea = consistencia.itemsConAdvertencia.get(index) ?? [];
    const topeConfidence = consistencia.confidenceMaximaPorItem.get(index);
    const confidenceOriginal = item.confidence;
    return {
      rawDescription: item.rawDescription,
      supplierCode: item.supplierCode,
      quantity: item.quantity,
      unitCost: item.unitCost,
      lineTotal: item.lineTotal,
      // NUEVO: nunca sube la confidence, solo puede bajarla.
      confidence: topeConfidence != null && confidenceOriginal != null
        ? Math.min(confidenceOriginal, topeConfidence)
        : confidenceOriginal,
      atributosExtra: /* sin cambios */,
      advertencias: advertenciasLinea, // NUEVO
    };
  }),
  // NUEVO: se agregan al array de warnings que ya devolvía el modelo, no lo reemplaza.
  warnings: [...datos.warnings, ...consistencia.advertenciasFactura],
  globalConfidence,
  aiModel: respuesta.model,
  aiUsage: respuesta.usage,
  aiRawResponse: parsed,
};
```

`InvoiceAiItem` (tipo, líneas 45-55) gana `advertencias: string[]`.

## Integración en `process/route.ts`

Diff conceptual sobre el `.map()` de `itemsData` (líneas 116-137 actuales):

```typescript
const itemsData = resultado.items.map((item) => {
  const match = matchearItem(/* sin cambios */);
  return {
    facturaId,
    textoOriginal: item.rawDescription,
    // ... resto de campos sin cambios ...
    atributosExtra: item.atributosExtra ?? undefined,
    advertencias: item.advertencias.length > 0 ? item.advertencias : undefined, // NUEVO
  };
});
```

`itemsData` sigue yendo por `createMany()` (sin cambios de forma, un campo más en el objeto) — no se altera el motivo original de ese cambio (evitar N round-trips, ver `fix-timeout-transaccion-facturas-proveedor`).

## Refuerzo de prompt (`invoice-extraction.config.ts`)

Se agrega una frase a la sección "Reglas para items" (después de la línea 508 actual, `"No calcules lineTotal desde unitCost*quantity"`), sin tocar el resto del prompt:

```text
- Antes de responder, verificá mentalmente que unitCost × quantity sea
  aproximadamente igual a lineTotal en cada línea. Si no coincide, es una señal
  de que puede haber tomado un valor de la fila incorrecta (columnas
  desalineadas) — en ese caso, preferí bajar tu propia confidence para esa
  línea en vez de forzar un valor que "cierre la cuenta" artificialmente.
```

Es aditivo al prompt existente — no cambia el JSON Schema (`buildExpectedOutputSchema()` no se toca en este punto), no agrega campos nuevos a lo que la IA debe devolver.

## Reemplazo de `validateExtractedInvoice()` por Zod (mantenibilidad, independiente)

Diseño del schema — reemplaza las ~180 líneas de `invoice-extraction.config.ts:690-867` por:

```typescript
import { z } from "zod";

const extraAttributeSchema = z.object({
  key: z.string(),
  value: z.string(),
});

const extractedInvoiceItemSchema = z.object({
  rawDescription: z.string(),
  supplierCode: z.string().nullable(),
  quantity: z.number(),
  unitCost: z.number().nullable(),
  lineTotal: z.number().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  extraAttributes: z.array(extraAttributeSchema),
});

export const extractedInvoiceSchema = z.object({
  supplier: z.object({
    name: z.string().nullable(),
    taxId: z.string().nullable(),
  }),
  invoice: z.object({
    number: z.string().nullable(),
    date: z.string().nullable(),
    currency: z.string().nullable(),
    total: z.number().nullable(),
  }),
  items: z.array(extractedInvoiceItemSchema),
  warnings: z.array(z.string()),
});

export function validateExtractedInvoice(
  data: unknown,
): InvoiceValidationResult {
  const resultado = extractedInvoiceSchema.safeParse(data);
  if (resultado.success) return { valid: true, errors: [] };
  return {
    valid: false,
    errors: resultado.error.issues.map(
      (i) => `${i.path.join(".")}: ${i.message}`,
    ),
  };
}
```

`InvoiceValidationResult` (tipo existente, `invoice-extraction.config.ts:123-126`) y la firma de `validateExtractedInvoice()` quedan **exactamente iguales** — es un cambio de implementación interna, no de contrato. Todo el código que ya llama a esta función (`invoice-ai-parser.ts:121`) sigue funcionando sin tocarse.

**Confirmación explícita del límite de este cambio** (para no repetirlo mal en la implementación): este schema de Zod habría aceptado sin error el JSON real que devolvió la IA para la factura #46 (incluyendo las líneas con precios desalineados) — `unitCost: 28500` es un `number` válido según el schema, sin importar si el papel dice 13900. La detección de ese error depende exclusivamente de `validarConsistenciaFactura()` (sección anterior), no de este cambio.

## Migración de Prisma

```sql
-- AlterTable
ALTER TABLE "FacturaProveedorItem" ADD COLUMN "advertencias" TEXT[] NOT NULL DEFAULT '{}';
```

`TEXT[]` (array nativo de Postgres) en vez de `Json?` — a diferencia de `atributosExtra` (que necesita pares clave-valor arbitrarios), acá el dato es siempre una lista plana de strings, mismo criterio ya aplicado a `Configuracion.columnasAtributosProducto` (`rubro-contexto-ocr/design.md`, sección "Nuevo campo en Configuracion"). Migración puramente aditiva, con default `'{}'` — no requiere backfill ni rompe filas existentes, mismo patrón que las migraciones recientes del proyecto (`20260701060000_add_max_facturas_ocr`, `20260701000000_add_proveedor_ocr_pipeline`).

## UI: indicador por fila en `factura-proveedor-dialog.tsx`

`FacturaProveedorItem` (tipo en `apiService.ts`) gana `advertencias: string[]`. En la tabla de items (líneas 654-886 del componente), junto al badge de `badgeEstado()` existente (que muestra el estado de _matching_), se agrega un ícono `AlertTriangle` (ya importado, se usa en el banner de la línea 650) cuando `item.advertencias.length > 0`, con un `Tooltip` (patrón ya usado en las acciones de cada fila, líneas 796-877) mostrando el texto de la advertencia. No reemplaza el badge de matching — son dos señales independientes que pueden coexistir en la misma fila (ej. `COINCIDENCIA_SEGURA` de producto + advertencia de monto inconsistente).

No se agrega ningún bloqueo: el usuario puede confirmar una línea con advertencia igual que hoy — la validación es informativa, coherente con que "nada actualiza stock hasta que el usuario aprueba" (regla ya vigente, sin cambios).

## Flujo de control objetivo (con inconsistencia detectada)

```text
POST /api/facturas-proveedor/[id]/process
  -> procesarFacturaConIA()
      -> extraerTextoFactura() [sin cambios]
      -> buildInvoiceExtractionPrompt() [+ regla de autoconsistencia, aditiva]
      -> callOpenRouterJson() [sin cambios de contrato]
      -> parseJsonContent + validateExtractedInvoice() [implementación Zod, mismo contrato]
      -> normalizarExtraccion() [sin cambios]
      -> [NUEVO] validarConsistenciaFactura(datos)
          <- { itemsConAdvertencia, advertenciasFactura, confidenceMaximaPorItem }
      -> [NUEVO] confidence por item = min(confidence original, tope si aplica)
      -> [NUEVO] warnings = warnings del modelo + advertenciasFactura
      <- InvoiceAiResult { ..., items: [{ ..., advertencias: [...] }], warnings: [...] }

  -> [de vuelta en process/route.ts]
  -> matchearItem() por item [sin cambios — señal independiente]
  -> tx.facturaProveedorItem.createMany({ data: itemsData })
      [NUEVO: cada item incluye advertencias]

Usuario revisa en factura-proveedor-dialog.tsx
  -> [NUEVO] fila con advertencias.length > 0 muestra ícono + tooltip
  -> [sin cambios] usuario decide: confirma, edita el valor a mano, o ignora la línea
```

## Compatibilidad hacia atrás

1. **Facturas ya procesadas antes de este cambio**: `FacturaProveedorItem.advertencias` queda `[]` (default de la migración) — la UI no muestra ningún ícono nuevo en filas viejas, no se reprocesan facturas existentes.
2. **Facturas donde la extracción es consistente** (caso mayoritario esperado): `validarConsistenciaFactura()` devuelve mapas vacíos, `confidence` e `warnings` quedan exactamente igual que hoy — cero cambio de comportamiento observable para el caso sano.
3. **Item sin `unitCost` o sin `lineTotal`** (cualquiera de los dos `null`): el chequeo #1 se salta esa línea (no hay suficiente dato para comparar, no se asume nada) — no genera falso positivo por dato faltante, distinto de dato incorrecto.

## Riesgos técnicos adicionales (no cubiertos en `proposal.md`)

- **La limitación documentada en "Caso de prueba de referencia"**: si una IA comete un error donde `unitCost`, `quantity` y `lineTotal` son _mutuamente_ consistentes pero los tres están mal (todos tomados de la fila vecina, como pasó acá), el chequeo #1 (por línea) no lo detecta — solo el chequeo #2 (suma vs total de factura) lo hace, y solo si el error no se cancela con otro error de signo contrario en otra línea de la misma factura. Es una limitación conocida y aceptada: no existe forma de detectar esto con certeza sin volver a mirar la imagen, que está fuera de alcance (ver "Fuera del Alcance" en `proposal.md`).
- **Índices de array como identificador de línea** (`index` en `AdvertenciaLinea`): funciona porque `datos.items` y `resultado.items.map(...)` preservan el mismo orden desde `normalizarExtraccion()` hasta `process/route.ts` — no hay ningún `sort`/`filter` entre medio que lo rompa (verificado leyendo el flujo completo arriba). Si en el futuro se agrega un paso que reordene o filtre items entre `procesarFacturaConIA()` y la persistencia, este acoplamiento por índice se rompe silenciosamente — vale la pena un comentario en el código marcando esta dependencia.

## Roadmap de Implementación

Dos partes independientes, pueden ir en PRs separados (la de Zod no depende de la aritmética ni viceversa):

### Parte A — Validación aritmética (núcleo del bug)

1. Migración Prisma: `FacturaProveedorItem.advertencias`.
2. `validar-consistencia-factura.ts` (nuevo módulo + tests con el caso real de la factura #46 como fixture).
3. `invoice-ai-parser.ts`: integrar la validación, extender `InvoiceAiItem.advertencias`.
4. `invoice-extraction.config.ts`: regla de autoconsistencia en el prompt (aditiva).
5. `process/route.ts`: persistir `advertencias` por item.
6. `apiService.ts`: tipo `FacturaProveedorItem.advertencias`.
7. `factura-proveedor-dialog.tsx`: indicador visual por fila.

**Listo cuando**: reprocesando la factura de prueba, las líneas con precio/cantidad desalineado quedan con `confidence` bajado y `advertencias` no vacío; la cabecera de la factura tiene un warning de "suma no coincide con total"; una factura consistente no genera ningún warning nuevo.

### Parte B — Zod (mantenibilidad)

1. `invoice-extraction.config.ts`: `extractedInvoiceSchema` con Zod, `validateExtractedInvoice()` reimplementada sobre `safeParse()`.
2. Test: mismo set de casos inválidos que hoy cubre la validación manual (si existen tests existentes) + el caso "tipos correctos, montos incorrectos" (confirma que Zod no reemplaza a la Parte A).

**Listo cuando**: `validateExtractedInvoice()` tiene la misma firma y comportamiento observable que antes (mismos JSON aceptados/rechazados), con menos código.

---

Ambas partes son aditivas y compatibles hacia atrás por sí solas — no hay dependencia técnica entre ellas, se pueden implementar y deployar en cualquier orden.
