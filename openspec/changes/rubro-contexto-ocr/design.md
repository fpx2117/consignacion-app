# Diseño: Rubro de Negocio como Contexto para OCR/IA de Facturas

## Análisis de la arquitectura actual (resumen, evidencia con file:line)

El pipeline hoy es: `upload/route.ts` (sube y crea `FacturaProveedor` en `PENDIENTE`, sin IA) → `[id]/process/route.ts` (dispara todo) → `extraerTextoFactura()` (`src/lib/ocr/extraer-texto-factura.ts`, pdf-parse o Tesseract, 100% local) → `procesarFacturaConIA()` (`src/lib/ai/invoice-ai-parser.ts:68`, arma prompt + schema desde `invoice-extraction.config.ts`, llama OpenRouter con `strict: true`) → `matching-engine.ts` (matchea contra catálogo por alias/nombre/fuzzy) → factura queda en `REQUIERE_REVISION` → usuario confirma/crea producto/ignora por item (`items/[id]/confirm`, `items/[id]/create-product`, `items/[id]/ignore`).

Puntos ya verificados en el código:
- El prompt es 100% estático, generado por `buildInvoiceExtractionPrompt()` (`invoice-extraction.config.ts:184`), sin parámetros — no hay ningún punto de inyección de contexto hoy.
- El schema es `additionalProperties: false` en cada nivel (`invoice-extraction.config.ts:216-261`), con `strict: true` forzado en el cliente HTTP (`src/lib/ai/openrouter-client.ts:76`).
- `FacturaProveedor.iaRespuestaCruda Json?` (`prisma/schema.prisma:764`) ya guarda el JSON crudo completo de la IA a nivel factura — pero es un blob de auditoría, no estructurado por item ni consumido por la UI de revisión. No sirve como reemplazo de un campo por-item: si la IA detectara "lote" en la línea 5 de 20 items, `iaRespuestaCruda` lo tiene en algún lugar del blob, pero no hay forma de mostrarlo junto a esa fila específica en la UI sin re-parsear todo el JSON crudo en el frontend.
- `FacturaProveedorItem` (`prisma/schema.prisma:780`) y `Producto` (`prisma/schema.prisma:221`) no tienen ningún campo `Json?`/`metadata`/`rawData` — se confirma que no hay nada reutilizable ahí; `atributosExtra` es un campo genuinamente nuevo, no una duplicación.
- El propio archivo de config ya tiene un TODO (`invoice-extraction.config.ts:307-310`) anticipando exactamente este caso: *"si en el futuro se necesita modelar [...] lote/vencimiento [...] primero hay que agregar esas columnas a FacturaProveedor/FacturaProveedorItem [...] después se extiende esta config y el prompt"*. Esta propuesta ejecuta ese TODO.
- `Configuracion` (`prisma/schema.prisma:9-42`) está keyed por `sucursalId Int @unique @default(1)` — una fila por sucursal, no una tabla de cuenta compartida. El endpoint `settings/general` ya opera así (`where: { sucursalId: auth.activeSucursalId }`).
- El Setup wizard (`src/app/setup/**`) no tiene ningún campo de rubro/categoría de negocio hoy — se confirmó revisando los 12 steps (`WelcomeStep` a `SuccessStep`); `BusinessStep.tsx` solo pide nombre, teléfono, dirección, logo, color.
- La identidad de negocio (nombre, logo, color) vive en `Branding` (`initialize/route.ts:335-354`), no en `Configuracion` — son dos modelos paralelos, ambos "uno por sucursal" en la práctica (`Branding.sucursalId`, `Configuracion.sucursalId`).

## Decisiones de arquitectura

Ver `proposal.md` sección "Enfoque" para las 8 decisiones centrales (prompt único con hint, `extraAttributes` como array de pares en vez de objeto libre, ubicación en `Configuracion`, `String?` en vez de enum, visión como fallback en un único llamado combinado, `atributosExtra` de `Producto` genérico y compartido por los 3 flujos de escritura, columnas de tabla por selección manual, cupo de OCR sin distinguir visión). Acá se detalla el "cómo" de cada una.

## Cambios al schema de Prisma

```prisma
model Configuracion {
  // ... campos existentes sin cambios ...
  rubroNegocio String?  // slug fijo (ver RUBROS_NEGOCIO) o texto libre si el usuario eligió "otro"
  columnasAtributosProducto String[] @default([])  // claves de atributosExtra promovidas a columna en productos-view.tsx
}

model FacturaProveedorItem {
  // ... campos existentes sin cambios ...
  atributosExtra Json?  // { [columna: string]: string } — columnas detectadas que no matchean ningún campo estándar
}

model Producto {
  // ... campos existentes sin cambios ...
  atributosExtra Json?  // mismo formato, copiado desde FacturaProveedorItem al crear/actualizar el producto
}
```

Cuatro columnas nullable/con default vacío — la migración es puramente aditiva (`ADD COLUMN ... NULL` / `ADD COLUMN ... DEFAULT '{}'`), mismo patrón que `prisma/migrations/20260701060000_add_max_facturas_ocr/migration.sql` (que agregó `PlanLimit.maxFacturasOcr` sin romper filas existentes).

## Cambios en `invoice-extraction.config.ts`

### Nuevo campo de item: `extraAttributes`

```typescript
export interface ExtractedInvoiceItem {
  rawDescription: string;
  supplierCode: string | null;
  quantity: number;
  unitCost: number | null;
  lineTotal: number | null;
  confidence: number | null;
  extraAttributes: Array<{ key: string; value: string }>; // nuevo
}
```

### `buildExpectedOutputSchema()` — diff conceptual sobre el item

```jsonc
{
  "type": "object",
  "properties": {
    "rawDescription": { "type": "string" },
    "supplierCode": { "anyOf": [{ "type": "string" }, { "type": "null" }] },
    "quantity": { "type": "number" },
    "unitCost": { "anyOf": [{ "type": "number" }, { "type": "null" }] },
    "lineTotal": { "anyOf": [{ "type": "number" }, { "type": "null" }] },
    "confidence": { "type": "number" },
    // NUEVO:
    "extraAttributes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "key": { "type": "string" },
          "value": { "type": "string" }
        },
        "required": ["key", "value"],
        "additionalProperties": false
      }
    }
  },
  "required": ["rawDescription", "supplierCode", "quantity", "unitCost", "lineTotal", "confidence", "extraAttributes"],
  "additionalProperties": false
}
```

`extraAttributes` es obligatorio en el schema (como todo bajo `strict: true`), pero su valor por defecto esperado es `[]` — no rompe nada si el rubro no aporta ninguna columna extra.

### `buildInvoiceExtractionPrompt(rubro?: string | null)` — diff conceptual

Se agrega un bloque **antes** de "Campos del comprobante a extraer", solo si `rubro` viene definido y no es vacío. El texto de "qué prestar atención" **no se redacta a mano en el prompt** — sale de una tabla `RUBRO_ATRIBUTOS_TIPICOS: Record<string, string>` (los mismos 17 valores de la tabla "Rubros iniciales propuestos" en `proposal.md`), la misma fuente de verdad que alimenta el selector del Setup. Así se manda solo el hint del rubro configurado, no una lista genérica de todos los rubros posibles en cada request (más corto, más barato en tokens, y más preciso):

```typescript
const RUBRO_ATRIBUTOS_TIPICOS: Record<string, string> = {
  kiosco: "",
  almacen: "cuenta corriente / fiado de clientes",
  farmacia: "lote, vencimiento, stock mínimo por medicamento",
  ferreteria: "unidad de medida, marca",
  indumentaria: "talle, color",
  panaderia: "venta por peso, producción diaria",
  carniceria: "venta por kilo, tipo de corte",
  verduleria: "venta por kilo o por unidad",
  electronica: "marca, modelo, IMEI/número de serie",
  pet_shop: "tipo de producto (alimento/accesorio/veterinario)",
  zapateria: "número (talle de calzado), color",
  libreria: "",
  gimnasio: "membresía vs. venta de suplementos (mixto servicio/producto)",
  veterinaria: "medicamentos, consultas registradas como ítem",
  peluqueria: "servicios + productos de cabello (mixto servicio/producto)",
  bar_cerveceria: "bebidas, stock por barril/botella",
  heladeria: "venta por kilo o unidad, sabores",
};
```

Si `rubro` es uno de los 17 slugs fijos con hint no vacío, el bloque queda así (ejemplo con `farmacia`):

```text
Contexto adicional: este negocio pertenece al rubro "farmacia". Usá esto
ÚNICAMENTE como contexto para anticipar qué columnas pueden aparecer además
de las estándar — en este rubro, prestá especial atención a: lote,
vencimiento, stock mínimo por medicamento. NO fuerces estos campos si no
aparecen en el texto, y NO dejes de extraer los campos estándar de abajo. Si
encontrás una columna que no es ninguno de los campos estándar mapeados,
guardala en "extraAttributes" como {key, value} en vez de descartarla — pero
segui sin inventar: si no aparece, no la incluyas.
```

Casos borde de esta misma lógica, sin ramas nuevas de código:
- **Rubro con hint vacío** (`kiosco`, `libreria`) o **texto libre no reconocido** (usuario eligió "Otro" y escribió algo que no matchea ningún slug): el bloque se arma igual pero sin la cláusula "prestá especial atención a…" (se omite si `RUBRO_ATRIBUTOS_TIPICOS[rubro]` es `undefined` o `""`) — el negocio queda igual identificado como contexto, sin inventar atributos que no aplican.
- **Rubro `null`/vacío**: no se agrega ningún bloque, prompt idéntico al actual.

El resto del prompt (reglas estrictas, campos de cabecera, campos de item) queda **exactamente igual** — es un único template con un bloque condicional al inicio, no un prompt distinto por rubro.

## Flujo de control objetivo (con rubro configurado)

```text
Usuario dispara el procesamiento
  -> POST /api/facturas-proveedor/[id]/process
      -> [NUEVO] lee Configuracion.rubroNegocio de factura.sucursalId
      -> procesarFacturaConIA({ buffer, mimeType, rubroNegocio })   [NUEVO parámetro]

          -> extraerTextoFactura() [sin cambios]
          -> buildInvoiceExtractionPrompt(rubroNegocio)   [NUEVO: bloque de contexto condicional]
          -> buildExpectedOutputSchema()                  [NUEVO: + extraAttributes]
          -> callOpenRouterJson(...)  [sin cambios de contrato]
          -> normalizarExtraccion(parsed) 
              [NUEVO: mapea extraAttributes[] -> objeto plano {key: value}]
          <- InvoiceAiResult { ..., items: [{ ..., extraAttributes: {...} }] }

      -> [de vuelta en process/route.ts, sin cambios de estructura]
      -> por cada item: tx.facturaProveedorItem.create({
             ...,
             atributosExtra: item.extraAttributes  // [NUEVO] null si objeto vacío
         })

Usuario revisa en factura-proveedor-dialog.tsx
  -> [NUEVO] si item.atributosExtra tiene claves, se muestra como chips de solo lectura
     bajo la descripción del item (ej. "lote: A123", "vto: 12/2026")

Usuario crea producto nuevo desde el item
  -> POST /api/facturas-proveedor/items/[id]/create-product
      -> [NUEVO] tx.producto.create({ ..., atributosExtra: item.atributosExtra })

Usuario confirma contra producto existente
  -> POST /api/facturas-proveedor/items/[id]/confirm
      -> [SIN CAMBIOS en esta iteración — atributosExtra del item NO se mergea
         automáticamente al producto existente, para no pisar datos de catálogo
         sin acción explícita del usuario. Queda como mejora futura opcional.]
```

Regla que se mantiene intacta: ningún resultado de la IA escribe stock/costo directamente — el gate de confirmación manual sigue siendo el único camino a `Producto`/`StockSucursal`/`HistorialCostoProducto`, exactamente como hoy.

## `atributosExtra` genérico en el catálogo de `Producto`

### Por qué un único schema alcanza para los 3 flujos

`createProductoBaseSchema` (`src/lib/validators/producto.ts:20-35`) es la única definición de "qué campos tiene un producto" en todo el backend — no hay un segundo schema paralelo para el flujo de OCR. Se confirma leyendo los 3 puntos de entrada:

- `src/app/api/productos/route.ts:210` — `createProductoSchema.safeParse(body)` (creación manual).
- `src/app/api/productos/[id]/route.ts:126` — `updateProductoSchema.safeParse(restOfBody)` (edición manual).
- `src/app/api/facturas-proveedor/items/[id]/create-product/route.ts:40` — `createProductoSchema.safeParse(body)` (creación desde OCR, mismo schema, mismo archivo de import).

Agregar `atributosExtra: z.record(z.string()).nullish()` a `createProductoBaseSchema` es un cambio de una línea que los 3 endpoints heredan sin tocarlos — coherente con la Decisión 6 de `proposal.md`.

### UI: sección genérica de pares clave-valor, no un formulario por rubro

`create-producto-dialog.tsx` y `edit-producto-dialog.tsx` ganan un componente compartido (ej. `AtributosExtraEditor`) — una lista de filas `{clave, valor}` con botón agregar/quitar, igual de genérico en los dos diálogos. La única diferencia entre rubros es el **placeholder** de la próxima clave sugerida, leído de la misma tabla `RUBRO_ATRIBUTOS_TIPICOS` que ya se usa en el prompt (Decisión 1):

```typescript
// Configuracion.rubroNegocio ya está disponible en el contexto de la página de Productos
// (mismo lugar donde ya se consulta para otras cosas de configuración)
const sugerencias = RUBRO_ATRIBUTOS_TIPICOS[rubroNegocio ?? ""]
  ?.split(", ")
  .filter(Boolean) ?? [];
// ej. rubroNegocio = "farmacia" -> sugerencias = ["lote", "vencimiento", "stock mínimo por medicamento"]
```

Es una sugerencia de autocompletado (no una validación) — el usuario puede escribir cualquier clave, coincida o no con las sugeridas. No hay bifurcación de componente por rubro, un único `AtributosExtraEditor` sirve para los 17 rubros + "Otro" + sin rubro.

### Flujo (creación/edición manual de producto)

```text
Usuario abre "Nuevo producto" (o edita uno existente)
  -> create-producto-dialog.tsx / edit-producto-dialog.tsx
      -> [NUEVO] sección "Atributos adicionales" (colapsada por default, igual que la
         sección de descuento) con AtributosExtraEditor
      -> sugerencias de clave desde RUBRO_ATRIBUTOS_TIPICOS[rubroNegocio de Configuracion]

  -> POST /api/productos  |  PUT /api/productos/[id]
      -> createProductoSchema / updateProductoSchema  [NUEVO: valida atributosExtra opcional]
      -> tx.producto.create / update({ ..., atributosExtra })  [sin cambios de estructura,
         solo un campo más en el mismo objeto de data]
```

Mismo patrón para el caso ya documentado de creación desde OCR (`create-product/route.ts`) — el único origen de datos distinto es de dónde sale el valor inicial de `atributosExtra` (prellenado desde `item.atributosExtra` en OCR, vacío en creación manual), la validación y persistencia son las mismas.

## Columnas dinámicas en la tabla de productos (Opción 1: selector manual)

### Estado actual (evidencia)

`productos-view.tsx` tiene 7 columnas fijas en el `<TableHeader>` (líneas 514-522: Producto, Categoría/Subcat., Estado, Stock, Vencimiento, Precio, Acciones). El sorting es **100% client-side**: `sorted` (línea 278) es un `useMemo` que ordena el array `filtered` ya cargado en memoria, comparando `a[sortConfig.key as keyof ProductoViewItem]` (línea 282) — no hay paginación ni orden server-side que adaptar. `SortKey` (línea 93) es un union type fijo: `"nombre" | "precioVenta" | "stockDisponibleUnits" | "categoria"`. La API (`GET /api/productos`) no usa `select:` explícito, así que trae el objeto `Producto` completo — `atributosExtra` viaja automáticamente en cuanto exista en el schema, sin tocar el endpoint.

### Nuevo campo en `Configuracion`

```prisma
model Configuracion {
  // ... campos existentes + rubroNegocio de la sección anterior ...
  columnasAtributosProducto String[] @default([])
}
```

`String[]` (array nativo de Postgres), no `Json?` — es una lista simple de claves (ej. `["talle", "color"]`), no requiere la flexibilidad de un JSON arbitrario. Se expone en `GET`/`PUT /api/settings/general` con el mismo patrón que `rubroNegocio` (mismo archivo, mismo endpoint, un campo más en el `upsert`).

### `SortKey` — extensión mínima

```typescript
type SortKey =
  | "nombre" | "precioVenta" | "stockDisponibleUnits" | "categoria"
  | `attr:${string}`; // NUEVO — ej. "attr:talle"
```

En el comparador (`productos-view.tsx:282-283`):

```typescript
let aValue: string | number | null | undefined;
let bValue: string | number | null | undefined;

if (sortConfig.key.startsWith("attr:")) {
  const clave = sortConfig.key.slice(5);
  aValue = (a.atributosExtra as Record<string, string> | null)?.[clave] ?? "";
  bValue = (b.atributosExtra as Record<string, string> | null)?.[clave] ?? "";
} else {
  aValue = a[sortConfig.key as keyof ProductoViewItem] as string | number | null | undefined;
  bValue = b[sortConfig.key as keyof ProductoViewItem] as string | number | null | undefined;
}
```

Valores ausentes (`undefined`/`""`) caen al final del orden — mismo comportamiento que ya tienen hoy los campos opcionales existentes, sin lógica nueva de null-handling.

### Selector de columnas (`columnas-producto-picker.tsx`, nuevo)

Popover con checkboxes, con dos fuentes de candidatas:

```typescript
// 1. Claves que YA existen en el catálogo cargado (dato real, no teórico)
const clavesEnUso = React.useMemo(() => {
  const set = new Set<string>();
  for (const p of items) {
    if (p.atributosExtra && typeof p.atributosExtra === "object") {
      Object.keys(p.atributosExtra).forEach((k) => set.add(k));
    }
  }
  return Array.from(set);
}, [items]);

// 2. Sugeridas por rubro (pueden no estar en uso todavía)
const sugeridasPorRubro = RUBRO_ATRIBUTOS_TIPICOS[rubroNegocio ?? ""]
  ?.split(", ")
  .filter(Boolean) ?? [];

const candidatas = Array.from(new Set([...clavesEnUso, ...sugeridasPorRubro]));
```

Al tildar/destildar, se hace `PUT /api/settings/general` con `columnasAtributosProducto` actualizado — mismo endpoint que ya usa el resto de la configuración, invalidando el mismo cache (`revalidateTag("config", "max")`, ya existente en ese route).

**Caso borde esperado — catálogo vacío en Setup**: `clavesEnUso` sale de `items` (el catálogo ya cargado en `productos-view.tsx`), que en un negocio recién creado está vacío. En ese momento el popover solo tiene candidatas de `sugeridasPorRubro` — es el comportamiento correcto, no un bug: a medida que el usuario carga productos y les agrega `atributosExtra`, esas claves empiezan a aparecer también como candidatas "en uso".

### Diff de tabla (desktop)

```text
<TableHeader>
  ...columnas fijas existentes...
  {columnasAtributosProducto.map((clave) => (
    <SortableHead key={clave} label={capitalize(clave)} sortKey={`attr:${clave}`} ... />
  ))}
  <TableHead>Acciones</TableHead>  {/* se mantiene al final */}
</TableHeader>

<TableBody>
  {sorted.map((p) => (
    <ProductoRow ...>
      ...celdas fijas existentes...
      {columnasAtributosProducto.map((clave) => (
        <TableCell key={clave}>
          {(p.atributosExtra as Record<string,string> | null)?.[clave] ?? "—"}
        </TableCell>
      ))}
    </ProductoRow>
  ))}
</TableBody>
```

### Vista mobile (`MobileProductCard`)

No se agregan columnas (no hay tabla en mobile) — los mismos `columnasAtributosProducto` se renderizan como `Badge` chips dentro de la card existente, reusando el componente `Badge` que ya se usa ahí para `codigoBarra` (línea 733 del mismo archivo).

### Por qué no hace falta tocar el backend de `/api/productos`

La API ya devuelve el objeto `Producto` completo sin `select:` — `atributosExtra` llega solo. El `columnasAtributosProducto` vive en `Configuracion`, que la página de Productos ya puede leer del mismo lugar de donde hoy resuelve otras preferencias de configuración (o se agrega una llamada liviana a `GET /api/settings/general` si todavía no se consulta ahí). Cero cambios en el modelo `Producto` en sí ni en cómo se consulta.

## Cambios en Setup

`BusinessStep.tsx` (`src/app/setup/**`) gana un selector (chips o `Select`) con las 17 opciones de `RUBROS_NEGOCIO` + campo de texto que aparece solo si se elige "Otro". Se agrega a `SetupFormData.rubroNegocio: string | null` (`setup/types.ts:53`) y se envía en `InitializePayload.rubroNegocio?: string` (`setup/types.ts:66`).

En `initialize/route.ts`, el `configuracion.upsert()` ya existente (línea 361) recibe una línea más en `create`/`update`:

```typescript
await tx.configuracion.upsert({
  where: { sucursalId },
  update: {
    // ... campos existentes ...
    ...(rubroNegocio !== undefined && { rubroNegocio: rubroNegocio || null }),
  },
  create: {
    // ... campos existentes ...
    rubroNegocio: rubroNegocio || null,
  },
});
```

Mismo patrón exacto que el resto de los campos de ese endpoint — no se introduce ninguna estructura nueva.

### Tope de longitud en el texto libre de "Otro"

Sin límite, un usuario podría pegar un párrafo largo como `rubroNegocio` — ese texto se interpola en **cada** prompt de OCR de ahí en adelante (Decisión 1), inflando tokens de forma silenciosa y permanente. Validación en dos capas, igual que el resto de los campos de este endpoint:

```typescript
// settings/general/route.ts, mismo bloque de validación que ya existe para tiendaMetodoPago/zonaHoraria
if (rubroNegocio !== undefined && rubroNegocio !== null && rubroNegocio.length > 60) {
  return NextResponse.json({ error: "El rubro no puede superar los 60 caracteres" }, { status: 400 });
}
```

Y `maxLength={60}` en el input de texto libre tanto en `BusinessStep.tsx` (Setup) como en la página de Ajustes — la validación de servidor es la que realmente importa (evita bypass vía API directa), el `maxLength` del input es solo UX.

### Nota de seguridad: texto libre interpolado en el prompt

`rubroNegocio` (cuando es texto libre de "Otro") se concatena directo en el system prompt que recibe OpenRouter (Decisión 1) — en términos generales esto es una superficie de "prompt injection". Acá el riesgo queda contenido por la arquitectura ya vigente: al ser single-tenant (cada cliente con su propia base de datos y sus propias credenciales de OpenRouter), un usuario que manipule su propio `rubroNegocio` con instrucciones adversariales solo podría afectar la extracción de *sus propias* facturas — no hay datos ni prompts de otros clientes en el mismo proceso o request. No se agrega sanitización adicional por este motivo; el tope de 60 caracteres de arriba ya limita bastante cuánto texto arbitrario cabe.

## Compatibilidad hacia atrás

Tres escenarios, los tres deben comportarse igual que hoy salvo por la mejora aditiva:

1. **Instalación existente, nunca pasa por este Setup de nuevo**: `rubroNegocio` queda `null` (columna nueva sin backfill). `buildInvoiceExtractionPrompt(null)` no agrega el bloque de contexto. `extraAttributes` sigue existiendo en el schema (porque el schema es único), pero la IA simplemente no tiene ningún hint especial y actúa como hoy — puede seguir devolviendo `extraAttributes: []` si no detecta nada fuera de lo estándar, que es el caso esperado sin rubro.
2. **Usuario configura rubro "Otro" sin texto**: tratado igual que `null` — el bloque de contexto no se agrega si el string está vacío.
3. **Facturas ya procesadas antes de este cambio**: sus `FacturaProveedorItem` existentes tienen `atributosExtra = null` — la UI simplemente no muestra los chips (no se reprocesan facturas viejas).

## Fallback híbrido: OCR + Visión cuando el texto local no alcanza

### Estado actual (evidencia)

`extraerTextoFactura()` (`src/lib/ocr/extraer-texto-factura.ts:24-49`) ya calcula un `confianzaOcr` (0-100): `100` fijo para PDF con texto nativo, y el score real de Tesseract para PDF escaneado/imagen. Ese número hoy solo se usa para el `Math.min` de `globalConfidence` (`invoice-ai-parser.ts:100`) — es puramente informativo, no dispara ninguna acción.

`procesarFacturaConIA()` (`invoice-ai-parser.ts:74-76`) corta con `status: "error"` si `texto` viene vacío, **antes** de construir el prompt o llamar a OpenRouter. No hay ningún intento de usar la imagen. Este es el failure mode más duro de los que se documentaron en la investigación previa del pipeline ("factura nunca se carga").

`callOpenRouterJson()` (`openrouter-client.ts:62-99`) arma `messages` con `content` como **string plano** (línea 92: `{ role: "user", content: input.userPrompt }`) — el formato OpenAI-compatible que usa OpenRouter soporta `content` como array de partes (`[{type:"text",...}, {type:"image_url",...}]`) para mensajes multimodales, pero hoy no se usa esa forma.

`ocr-engine.ts` ya rasteriza PDFs a PNG vía Chromium (`rasterizarPdf()`) y ya preprocesa imágenes con `sharp` (`preprocesarImagen()`, línea 48) — pero ese preprocesado (escala de grises, upscaling agresivo) está optimizado para el motor de caracteres de Tesseract, no para un modelo de visión: un LLM de visión rinde mejor con la imagen a color, sin el grayscale forzado que sí ayuda a Tesseract.

### Diseño propuesto

**Umbral de decisión**: nueva constante `OCR_VISION_FALLBACK_THRESHOLD` (env var, default `55`, mismo estilo que `OCR_TIMEOUT_MS`/`OCR_MAX_TOKENS`). Se compara contra `confianzaOcr` ya calculado — cero costo adicional de cómputo para decidir.

**`extraerTextoFactura()` — nuevo campo en el resultado**:

```typescript
export type TextoFacturaExtraido = {
  texto: string;
  confianzaOcr: number;
  imagenParaVision: Buffer | null; // NUEVO — null si fue PDF con texto nativo (no se rasterizó nada)
};
```

Para el camino PDF-escaneado/imagen (donde ya se rasteriza/lee un buffer de imagen), se genera además una copia **liviana pero a color** con `sharp` — redimensionada a un ancho máximo (ej. 1600px) y recodificada a JPEG calidad ~80, para acotar el costo en tokens de visión sin mandar el archivo original sin comprimir. Para el camino de PDF con texto nativo, `imagenParaVision` queda `null` — nunca se rasteriza nada si el texto nativo ya alcanzó (no hay regresión de costo/latencia para ese caso, que es la mayoría).

**`callOpenRouterJson()` — soporte multimodal**:

```typescript
export async function callOpenRouterJson(input: {
  systemPrompt: string;
  userPrompt: string;
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  images?: Array<{ mimeType: string; base64: string }>; // NUEVO
}): Promise<OpenRouterChatResult> {
  // ...
  const userContent = input.images?.length
    ? [
        { type: "text", text: input.userPrompt },
        ...input.images.map((img) => ({
          type: "image_url",
          image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
        })),
      ]
    : input.userPrompt;

  const model = input.images?.length
    ? (process.env.OPENROUTER_VISION_MODEL || "openai/gpt-4o-mini")
    : OPENROUTER_MODEL;

  // body.model = model; body.messages = [{role:"system",...}, {role:"user", content: userContent}]
}
```

`OPENROUTER_VISION_MODEL` es una variable independiente de `OPENROUTER_MODEL` — si en el futuro se cambia el modelo primario a uno texto-only más barato, el fallback de visión sigue funcionando sin depender de esa elección.

**`procesarFacturaConIA()` — lógica de decisión**:

```typescript
const { texto, confianzaOcr, imagenParaVision } = await extraerTextoFactura(input);

const necesitaVision = imagenParaVision && (
  !texto.trim() || confianzaOcr < OCR_VISION_FALLBACK_THRESHOLD
);

if (!texto.trim() && !necesitaVision) {
  // caso residual: PDF con texto nativo que igual vino vacío — no hay imagen que ofrecer
  return { status: "error", message: "No se pudo extraer texto legible del archivo." };
}

const userPrompt = necesitaVision
  ? `Extraé los datos estructurados de esta factura. El texto que devolvió el OCR local ` +
    (texto.trim() ? `tiene baja confianza (${confianzaOcr}%) y puede tener errores o partes faltantes` : `no pudo leer nada`) +
    `. Se adjunta también la imagen original — usá el texto como referencia rápida y la imagen para completar o corregir lo que falte.\n\nTexto OCR:\n${texto || "(vacío)"}`
  : `Extraé los datos estructurados de esta factura de proveedor según las reglas indicadas:\n\n${textoTruncado}`;

const respuesta = await callOpenRouterJson({
  systemPrompt,
  userPrompt,
  jsonSchema: { name: "factura_extraida", schema },
  images: necesitaVision ? [{ mimeType: "image/jpeg", base64: imagenParaVision!.toString("base64") }] : undefined,
});
```

**Confianza final cuando se usó visión**: hoy `globalConfidence = Math.min(calculateInvoiceConfidence(datos), confianzaOcr / 100)` (`invoice-ai-parser.ts:100`) — ese `Math.min` penaliza injustamente una extracción que la IA rescató bien con la imagen, capándola al `confianzaOcr` (bajo, por definición, si se llegó a este camino). Cuando `necesitaVision` fue `true`, se usa directamente `calculateInvoiceConfidence(datos)` (confianza propia de la IA, que sí tuvo la imagen) sin el `Math.min` contra el OCR local.

**Trazabilidad — sin columna nueva**: `FacturaProveedor.iaModeloUsado` (`prisma/schema.prisma:763`, ya existe) va a quedar con el modelo de visión (ej. `openai/gpt-4o-mini`) en vez del modelo primario cuando se usó este camino — alcanza para auditar/filtrar sin agregar ninguna columna booleana tipo `usoVision`.

**Cupo de suscripción (Decisión 8)**: `checkFacturaOcrLimit()` (`require-subscription.ts:88`) se llama antes de `procesarFacturaConIA()` en `process/route.ts`, sin depender de si terminó usando visión — la decisión de "cuánto cuesta" se toma después de que el cupo ya fue validado, así que no hace falta ningún cambio en esa función. Solo cambia lo que se loggea *después* de la llamada a OpenRouter.

**Logging del uso de visión — extensión del log existente**:

```typescript
// openrouter-client.ts:134-139, diff conceptual
console.log("[OpenRouter]", {
  model: json.model || OPENROUTER_MODEL,
  elapsedMs: Date.now() - startedAt,
  reasoningTokens: json.usage?.completion_tokens_details?.reasoning_tokens ?? null,
  totalTokens: json.usage?.total_tokens ?? null,
  usedVision: Boolean(input.images?.length), // NUEVO
});
```

Sin tabla ni endpoint de métricas nuevo — es exactamente el mismo log que ya se emite hoy por cada llamada, con un campo booleano más, grepeable en los logs de Railway (`usedVision":true`) para contar manualmente cuántas facturas escalaron en un período dado, antes de decidir si hace falta tocar la Decisión 8 más adelante.

### Flujo de control (caso con fallback activado)

```text
POST /api/facturas-proveedor/[id]/process
  -> extraerTextoFactura()
      -> PDF escaneado/imagen: rasteriza (si aplica) + Tesseract
      -> [NUEVO] además genera imagenParaVision (color, comprimida, sharp)
      <- { texto: "...ilegible...", confianzaOcr: 32, imagenParaVision: <Buffer> }

  -> confianzaOcr (32) < OCR_VISION_FALLBACK_THRESHOLD (55) -> necesitaVision = true

  -> callOpenRouterJson({
       systemPrompt: buildInvoiceExtractionPrompt(rubroNegocio),  // mismo prompt de siempre
       userPrompt: "...texto OCR baja confianza + instrucción de usar imagen...",
       jsonSchema: buildExpectedOutputSchema(),  // mismo schema de siempre, sin cambios
       images: [{ mimeType: "image/jpeg", base64: "..." }],
     })
      -> model = OPENROUTER_VISION_MODEL (no OPENROUTER_MODEL)
      -> mismo response_format json_schema strict:true de siempre

  -> parseJsonContent + validateExtractedInvoice  [sin cambios]
  -> globalConfidence = calculateInvoiceConfidence(datos)  [sin el Math.min contra confianzaOcr]
  -> [de acá en adelante, exactamente el mismo flujo de matching-engine + persistencia de siempre]
```

Ningún componente aguas abajo (matching-engine, confirmación, stock, costo) se entera de si el origen fue texto-only o texto+imagen — el resultado que consumen tiene la misma forma (`InvoiceAiResult`) en ambos casos. Es un cambio contenido enteramente en `extraer-texto-factura.ts` + `invoice-ai-parser.ts` + `openrouter-client.ts`.

## Migraciones

Una sola migración Prisma, aditiva (el fallback de visión no requiere ninguna columna nueva — reusa `iaModeloUsado`):

```sql
-- AlterTable
ALTER TABLE "Configuracion" ADD COLUMN "rubroNegocio" TEXT;
ALTER TABLE "Configuracion" ADD COLUMN "columnasAtributosProducto" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "FacturaProveedorItem" ADD COLUMN "atributosExtra" JSONB;
ALTER TABLE "Producto" ADD COLUMN "atributosExtra" JSONB;
```

Sin backfill, sin downtime, sin `NOT NULL` — aplicable con `prisma migrate deploy` igual que las migraciones recientes del proyecto.

## Riesgos

Ver `proposal.md`. El único riesgo técnico no cubierto ahí: si en el futuro se agrega edición de `atributosExtra` en la UI, hay que decidir si el merge hacia `Producto` en `confirm/route.ts` es automático o requiere opt-in explícito — se deja fuera de esta iteración a propósito para no tomar esa decisión sin uso real del campo primero.

## Roadmap de Implementación (por fases)

Orden confirmado: cada fase es un PR/deploy independiente. El criterio de secuencia es dependencia técnica real (no se puede usar `rubro` en el prompt si `Configuracion.rubroNegocio` no existe) + menor riesgo primero (la Fase 1 no toca schema ni Setup, así que es la más chica y aislada para arrancar).

### Fase 1 — Fallback híbrido OCR + Visión

Cero dependencias de las otras fases — no toca `prisma/schema.prisma`. Arregla un bug real que existe hoy (`invoice-ai-parser.ts:74-76` corta con error directo si el OCR devuelve texto vacío, sin intentar nada más).

1. `openrouter-client.ts`: `callOpenRouterJson()` acepta `images?`, arma `content` multimodal, selecciona `OPENROUTER_VISION_MODEL` cuando hay imágenes.
2. `ocr-engine.ts`/`extraer-texto-factura.ts`: generar `imagenParaVision` (color, comprimida) junto al resultado de OCR existente.
3. `invoice-ai-parser.ts`: lógica de `necesitaVision` (umbral `OCR_VISION_FALLBACK_THRESHOLD`), userPrompt condicional, ajuste del cálculo de `globalConfidence` cuando se usó visión.
4. `.env.example`: documentar `OCR_VISION_FALLBACK_THRESHOLD` y `OPENROUTER_VISION_MODEL`.
5. `openrouter-client.ts`: sumar `usedVision: boolean` al log estructurado existente (línea 134-139).

**Listo cuando**: una factura con OCR vacío intenta visión antes de reportar error; una factura con `confianzaOcr` alta no manda imagen (cero cambio de costo/latencia para el caso común); el umbral es variable de entorno; el modelo usado queda en `iaModeloUsado`.

### Fase 2 — Rubro como contexto (núcleo)

La única fase con migración de Prisma — se agregan las 4 columnas de una sola vez acá (aunque `Producto.atributosExtra` y `columnasAtributosProducto` recién se consumen en las Fases 3 y 4), para no repetir el evento de migración tres veces por algo puramente aditivo.

1. Migración Prisma: `Configuracion.rubroNegocio`, `Configuracion.columnasAtributosProducto`, `FacturaProveedorItem.atributosExtra`, `Producto.atributosExtra` + `prisma generate`.
2. `RUBRO_ATRIBUTOS_TIPICOS`: módulo compartido (ej. `src/modules/invoices/config/rubros.ts`) — única fuente de verdad para los 17 rubros + hints, consumida por el prompt, el selector de Setup y (en fases siguientes) el editor de atributos y el picker de columnas.
3. `invoice-extraction.config.ts`: `extraAttributes` en tipo, schema y prompt; `buildInvoiceExtractionPrompt(rubro?)`.
4. `invoice-ai-parser.ts`: `procesarFacturaConIA` acepta `rubroNegocio`, `normalizarExtraccion` mapea `extraAttributes`.
5. `process/route.ts`: lee `Configuracion.rubroNegocio` de la sucursal de la factura, lo pasa, persiste `atributosExtra` por item.
6. `settings/general/route.ts` + página de Ajustes: exponer `rubroNegocio` editable, con validación de longitud (60 caracteres).
7. `setup/types.ts` + `BusinessStep.tsx` + `initialize/route.ts`: selector de rubro en Setup (17 opciones + "Otro").
8. `factura-proveedor-dialog.tsx`: mostrar `atributosExtra` como chips de solo lectura.
9. `apiService.ts`: tipos actualizados en los payloads existentes.

**Listo cuando**: con rubro "Farmacia" configurado, una factura con lote/vencimiento las captura en `atributosExtra` del item; el rubro es editable desde Ajustes y se refleja en el próximo procesamiento; `buildExpectedOutputSchema()` sigue siendo un único schema; un negocio sin rubro configurado tiene exactamente el mismo comportamiento que antes del cambio.

### Fase 3 — `atributosExtra` genérico en `Producto`

Depende de que la migración de la Fase 2 ya esté en producción (necesita `Producto.atributosExtra` existente). No depende de que el usuario haya configurado un rubro — funciona igual, solo sin sugerencias de clave.

1. `validators/producto.ts`: `atributosExtra` opcional en `createProductoBaseSchema` (hereda a `createProductoSchema` y `updateProductoSchema`, cubre los 3 flujos de escritura sin duplicar validación).
2. `create-product/route.ts`: copia `atributosExtra` del item al producto nuevo creado desde OCR.
3. `create-producto-dialog.tsx` / `edit-producto-dialog.tsx`: componente compartido `AtributosExtraEditor` (pares clave-valor + sugerencias desde `RUBRO_ATRIBUTOS_TIPICOS`), sección colapsada por default.

**Listo cuando**: un producto creado a mano puede tener `atributosExtra` agregados desde el diálogo de creación; un producto existente (de OCR o manual) puede editar su `atributosExtra` desde el diálogo de edición; los 3 endpoints de escritura de `Producto` comparten el mismo schema, sin ramas por rubro.

### Fase 4 — Columnas dinámicas en la tabla de productos

Depende de que ya haya productos reales con `atributosExtra` cargado (Fase 3) — sin eso, el selector de columnas no tendría "claves en uso" para ofrecer (solo las sugeridas por rubro, ver nota de caso borde más abajo).

1. `productos-view.tsx`: extender `SortKey` para aceptar `attr:{clave}` y el branch correspondiente en el comparador de `sorted`; renderizar columnas/celdas dinámicas desde `columnasAtributosProducto`.
2. `columnas-producto-picker.tsx` (nuevo): popover de selección de columnas, candidatas = claves en uso en el catálogo + sugeridas por rubro; persiste vía `PUT /api/settings/general`.
3. `MobileProductCard`: renderizar `columnasAtributosProducto` como badges (reusando el patrón ya existente para `codigoBarra`).

**Listo cuando**: con rubro "Indumentaria" y columnas "talle"/"color" activadas, la tabla las muestra como columnas reales ordenables; un negocio que nunca activó ninguna columna ve la tabla exactamente igual que hoy; la preferencia persiste entre sesiones (no solo estado local); mobile muestra badges, no columnas.

---

Cada fase es aditiva y compatible hacia atrás por sí sola — ninguna fase posterior es requisito para que la anterior funcione correctamente en producción. Se puede pausar después de cualquier fase (incluso después de la Fase 1 sola) sin dejar nada roto ni a medio camino.
