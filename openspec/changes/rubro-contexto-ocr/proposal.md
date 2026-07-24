# Propuesta: Rubro de Negocio + Fallback Híbrido OCR/Visión para Facturas

## Intención

El pipeline de OCR + IA de facturas de proveedor (`src/lib/ai/invoice-ai-parser.ts` + `src/modules/invoices/config/invoice-extraction.config.ts`) es hoy deliberadamente agnóstico de rubro: no asume IVA, packaging ni columnas fijas. Esto es correcto como base, pero tiene un costo — la IA no tiene ninguna pista de qué tipo de negocio está procesando, así que no puede anticipar qué columnas "raras" son normales para ese rubro (lote/vencimiento en farmacia, talle/color/marca en indumentaria, marca/línea/ML/EDT/EDP en perfumería). Hoy esas columnas, cuando aparecen, se pierden: no hay dónde guardarlas (`FacturaProveedorItem` y `Producto` no tienen un campo libre) y el prompt no le pide a la IA que las busque.

Además, el pipeline hoy depende 100% del texto que devuelve el OCR local (pdf-parse/Tesseract). Si ese texto sale vacío, la extracción corta con error directo sin siquiera llamar a la IA (`invoice-ai-parser.ts:74-76`). Si sale con baja confianza pero no vacío, se le manda igual a la IA tal cual, sin ningún respaldo. Esta propuesta suma un segundo mecanismo, complementario: cuando el OCR local no alcanza, escalar a un modelo con visión mandándole **texto OCR (aunque venga incompleto) + la imagen original juntos**, para que la IA cruce ambas fuentes en vez de depender de una sola que puede haber fallado.

El objetivo combinado es que, durante el Setup inicial (y editable después desde Ajustes), el usuario declare el rubro de su negocio para dar contexto a la IA, **y** que el pipeline sea resiliente cuando el OCR local no puede leer bien una factura — ambos cambios reusan el mismo prompt/JSON Schema único, sin bifurcar el pipeline ni crear variantes por caso.

## Alcance

### Dentro del Alcance

1. **Campo `rubroNegocio` en `Configuracion`** (String, nullable) — se completa en el Setup (paso `BusinessStep`), editable en `/settings/general`.
2. **Campo `atributosExtra` (Json?) en `FacturaProveedorItem`** — bucket libre donde la IA guarda columnas detectadas que no matchean ningún campo estándar (lote, vencimiento, talle, color, marca, ML, etc.), como pares clave-valor.
3. **Campo `atributosExtra` (Json?) en `Producto`** — mismo propósito pero a nivel catálogo, para que esos atributos persistan más allá de la revisión de la factura si el usuario los confirma.
4. **`buildInvoiceExtractionPrompt(rubro?: string | null)`** — el prompt sigue siendo uno solo; si hay rubro configurado, se le antepone un párrafo de contexto (no una rama de lógica distinta).
5. **`buildExpectedOutputSchema()`** — se agrega una propiedad `extraAttributes` (array de `{key, value}`) al objeto de cada item. Sigue siendo un único schema, sin variantes.
6. **Paso de Setup**: extender `BusinessStep` (no agregar un wizard step nuevo) con un selector de rubro de 8 opciones fijas + "Otro" (texto libre).
7. **`/settings/general`**: agregar `rubroNegocio` al `GET`/`PUT` existente, mismo patrón que el resto de los campos.
8. **UI de revisión de factura** (`factura-proveedor-dialog.tsx`): mostrar `atributosExtra` del item si existe (solo lectura por ahora, no editable en esta primera iteración).
9. **Fallback híbrido OCR + Visión**: cuando `confianzaOcr` (de `extraerTextoFactura()`) esté por debajo de un umbral configurable, o el texto venga vacío, se manda a OpenRouter un único llamado con texto OCR + imagen original juntos, usando un modelo con capacidad de visión. Detalle completo en `design.md`.
10. **`callOpenRouterJson()`** (`src/lib/ai/openrouter-client.ts`) acepta un parámetro opcional de imágenes, y selecciona modelo de visión solo cuando corresponde — sin tocar el camino texto-only existente.
11. **`Producto.atributosExtra` es genérico y editable en el catálogo, no solo un subproducto de la OCR**: `createProductoBaseSchema` (`src/lib/validators/producto.ts`) es el único schema detrás de los 3 puntos de entrada a `Producto` — creación manual (`POST /api/productos`), edición manual (`PUT /api/productos/[id]`) y creación desde OCR (`POST /api/facturas-proveedor/items/[id]/create-product`). Se agrega `atributosExtra` ahí una sola vez y los 3 flujos lo heredan sin duplicar validación. `create-producto-dialog.tsx` y `edit-producto-dialog.tsx` ganan una sección genérica de pares clave-valor (agregar/quitar fila), sugiriendo como placeholders las claves de `RUBRO_ATRIBUTOS_TIPICOS[rubroNegocio]` (ej. si el rubro es Farmacia, sugiere "lote"/"vencimiento" como próxima clave a completar) — son sugerencias de UI, no campos obligatorios ni validación distinta por rubro.
12. **Columnas dinámicas en la tabla de productos, elegidas por el usuario**: nuevo campo `Configuracion.columnasAtributosProducto String[]` — lista de claves de `atributosExtra` que el usuario decide mostrar como columna en `productos-view.tsx`. Selector manual (popover con checkboxes), no detección automática — ver Decisión 7. Aplica tanto a la tabla desktop como a las cards de la vista mobile.
13. **El fallback de visión consume el mismo cupo de `PlanLimit.maxFacturasOcr` que una factura texto-only** — decisión explícita, ver Decisión 8. No hay una unidad de cupo distinta para "factura procesada con imagen".
14. **Logging del uso de visión**: el log estructurado que ya existe en `callOpenRouterJson()` (`openrouter-client.ts:134-139`) suma un campo `usedVision: boolean` — sin tabla ni dashboard nuevo, solo grepeable en los logs de Railway para poder ajustar el umbral con datos reales.
15. **Tope de longitud en `rubroNegocio` texto libre**: 60 caracteres, validado en `PUT /api/settings/general` y en el input de "Otro" del Setup — evita que un texto largo se mande en cada request de OCR de ahí en adelante.

### Fuera del Alcance

- Taxonomía extensible de rubros gestionada por el usuario (la lista es fija en código; agregar uno nuevo es un cambio de una constante, no una migración).
- Edición de `atributosExtra` **en la revisión de la factura** (`factura-proveedor-dialog.tsx` sigue mostrándolo de solo lectura ahí — la edición vive en los diálogos de producto, ver punto 11, no duplicada en dos lugares).
- Cualquier lógica que bloquee o cambie el flujo de confirmación en base al rubro.
- Prompts o JSON Schemas separados por rubro — explícitamente rechazado, ver sección Enfoque.
- Reclasificar rubro por sucursal individualmente en la UI de Setup (se declara una vez; ajustar por sucursal queda disponible en Ajustes si el negocio lo necesita, sin flujo dedicado).
- Visión como camino primario/por defecto — solo se activa como fallback ante confianza baja o texto vacío, nunca reemplaza el camino texto-only para el caso común.
- Reintentos múltiples o segunda pasada de visión si el primer intento con imagen tampoco alcanza — se reporta como advertencia/revisión manual, no se encadenan más llamados.
- **`atributosExtra` en el reporte PDF de inventario** (`inventory-report-template.ts`): columnas fijas hoy (Producto, Vencimiento, Stock, Costo, Venta, Subtotal), sin espacio para atributos dinámicos. Queda fuera de esta iteración, con la salvedad de que si el usuario activa columnas en la tabla de productos, es esperable que las quiera también en el PDF exportado — candidato natural para una iteración siguiente sobre `openspec/changes/mejora-reportes-pdf/`, no acá.
- **Importación de catálogo desde Excel/CSV**: no existe hoy en el proyecto (se confirmó que no hay dependencia `xlsx`/`csv` ni ruta de importación) pese a estar prometida en el material de marketing de algunas verticales (ej. Ferretería). No es parte de este cambio — si se construye en el futuro, debería escribir a `atributosExtra` desde el diseño inicial (una columna de Excel llamada "Talle" mapeando directo a esa clave) en vez de necesitar retrofit.
- **Cambiar la política de cupo de OCR según si se usó visión** (cobrar más de 1 unidad, o restringir visión a ciertos planes) — se deja la puerta abierta con el logging del punto 14, pero no se implementa en esta iteración sin datos reales de cuánto cuesta en la práctica.
- **Sistema de variantes de producto** (un producto padre con talles/colores hijos, stock por variante). `Producto` sigue siendo 1 fila = 1 SKU, exactamente como hoy — las columnas dinámicas solo ayudan a _distinguir_ filas de un vistazo, no cambian esa relación.
- Detección automática de qué claves promover a columna (Opción 2 evaluada y descartada, ver Decisión 7) — siempre es elección explícita del usuario.
- Límite máximo de columnas configurable a nivel de código (no se hardcodea un tope) — queda como una decisión de UX/producto, no de arquitectura.

## Enfoque

### Decisión 1: el rubro es un hint de prompt, no un schema distinto

**Elección**: un solo `buildInvoiceExtractionPrompt()`, con un bloque de contexto opcional al principio cuando hay rubro configurado.

**Alternativas consideradas**:

- Un `json_schema` distinto por rubro (ej. `PERFUMERIA_SCHEMA`, `FARMACIA_SCHEMA`).
- Prompts completamente distintos por rubro, seleccionados en runtime.

**Justificación**: OpenRouter se llama con `strict: true` (`src/lib/ai/openrouter-client.ts:76`), que ya fuerza tipos exactos. Mantener un solo schema es lo que hace que agregar un campo sea "tocar una config", no "tocar N archivos". Además, ningún negocio real es 100% puro de un rubro — un kiosco vende de todo, un mayorista mezcla categorías. Un hint contextual mejora la atención de la IA sin apostar todo el pipeline a una clasificación que el propio usuario puede declarar mal o de forma incompleta. Si el rubro no está seteado, o es "Otro", el comportamiento es exactamente el actual (prompt sin el bloque de contexto).

### Decisión 2: `atributosExtra` como array `{key, value}`, no objeto libre

**Elección**: en el JSON Schema que ve la IA, `extraAttributes` es `array<{key: string, value: string}>`, no un objeto con claves dinámicas.

**Alternativas consideradas**:

- Objeto JSON libre (`{"lote": "A123", "vencimiento": "2026-12"}`) directo en el schema.

**Justificación**: JSON Schema en modo `strict` (OpenAI-compatible structured outputs, que es lo que exige OpenRouter con `strict: true`) no soporta bien `additionalProperties: true` con claves arbitrarias — todas las propiedades deben estar enumeradas de antemano. Un array de pares clave-valor es el patrón estándar para modelar "diccionario dinámico" dentro de una salida estructurada estricta. Al persistir (`normalizarExtraccion()` en `invoice-ai-parser.ts:123`), se puede convertir a objeto plano (`{lote: "A123", ...}`) para que la UI lo consuma más cómodo — la columna `atributosExtra Json?` en Prisma acepta cualquier JSON válido, así que esa conversión es un detalle de la capa de normalización, no del schema Prisma.

### Decisión 3: el rubro vive en `Configuracion` (per-sucursal), no en un modelo nuevo

**Elección**: `rubroNegocio String?` en `Configuracion`, tal como pidió el usuario.

**Nota arquitectónica importante**: `Configuracion` hoy **no es un singleton verdaderamente global** — está modelado como una fila por sucursal (`sucursalId Int @unique @default(1)`, ver `prisma/schema.prisma:22` y el patrón de `GET`/`PUT` en `src/app/api/settings/general/route.ts:44-45`, que siempre resuelve `where: { sucursalId: auth.activeSucursalId }`). "Global" en el vocabulario de este proyecto significa "una config por sucursal", no "una config por cuenta". Esto no es un problema para el caso común (negocio de un solo rubro, todas sus sucursales son del mismo tipo) — el Setup escribe `rubroNegocio` en la sucursal que se crea durante el wizard (`sucursalId` resuelto en `initialize/route.ts:361`), y si el negocio tiene una sola sucursal (el caso típico de este SaaS), ese valor es efectivamente global. Si en el futuro un cliente con múltiples sucursales quisiera rubros distintos por sucursal (ej. una cadena con local de indumentaria y otro de perfumería), el modelo actual ya lo permite sin cambios adicionales — es una ventaja emergente de reusar `Configuracion` tal cual está, no una complicación.

**Alternativa considerada y descartada**: agregar `rubroNegocio` a `Branding` (que sí concentra identidad del negocio: nombre, logo, color — ver `initialize/route.ts:331-354`). Se descarta porque el usuario fue explícito en que debe vivir en `Configuracion`, y porque `Configuracion` es lo que ya se lee en el punto exacto donde se dispara el llamado a OpenRouter (`process/route.ts`), evitando un join adicional a `Branding` en el hot path del procesamiento.

### Decisión 4: `rubroNegocio` es `String?`, no un enum de Postgres/Prisma

**Elección**: columna de texto libre, con una lista fija de valores válidos (`RUBROS_NEGOCIO` en TypeScript) que la UI usa para el selector + opción "Otro" con texto libre.

**Alternativas consideradas**:

- `enum RubroNegocio { KIOSCO PERFUMERIA FARMACIA ... }` nativo de Prisma/Postgres.

**Justificación**: un enum de Postgres requiere una migración (`ALTER TYPE ... ADD VALUE`) cada vez que se agrega un rubro nuevo, y esa operación tiene restricciones de transacción según la versión de Postgres. Con `String?` + una constante de aplicación, agregar un rubro es cambiar un array en TypeScript — coherente con "no quiero perfiles OCR extremadamente complejos" y con cómo ya se maneja `tiendaMetodoPago` en este mismo modelo (`String @default("whatsapp")`, validado a mano en el route en vez de con un enum de Prisma — ver `src/app/api/settings/general/route.ts:102-104`).

### Decisión 5: visión como fallback condicional en un único llamado combinado, no como camino paralelo

**Elección**: un solo umbral de confianza (`confianzaOcr`, que ya calcula `extraerTextoFactura()`) decide si el llamado a OpenRouter incluye la imagen además del texto. No hay dos llamados secuenciales (uno de texto, y si falla, uno de visión) — es un único llamado que manda ambas señales juntas cuando hace falta.

**Alternativas consideradas**:

- Reintento secuencial: primero texto-only, si `items: []` o error de validación, reintentar con imagen.
- Visión como camino por defecto para todo, texto como optimización.
- Dos modelos corriendo siempre en paralelo y comparando resultados.

**Justificación**: un reintento secuencial duplica la latencia (dos round-trips a OpenRouter, cada uno con su propio timeout de hasta 150s) para el caso que ya sabíamos de antemano que iba a fallar — si `confianzaOcr` ya es baja, no hace falta gastar el primer intento texto-only para descubrirlo. Visión por defecto para todo revierte la decisión de costo ya tomada en la migración a OpenRouter (`migracion-ocr-openrouter/design.md:11-19`), que fue justamente alejarse de eso. Un único llamado combinado, gateado por el mismo `confianzaOcr` que ya se calcula sin costo adicional, da lo mejor de ambos: la mayoría de las facturas (OCR con confianza alta) siguen constando centavos sin tocar código nuevo, y solo el subconjunto problemático paga el costo de imagen — una sola vez, no dos.

**Adenda post-implementación (medido con datos reales tras la Fase 1)**: se evaluó pivotar a "imagen directa siempre para fotos/PDF escaneado, Tesseract solo como fallback de emergencia" — motivado por que `openai/gpt-4o-mini` resultó más barato por token que `qwen/qwen3.6-35b-a3b` (el modelo de texto que se usaba hasta acá) y lee imágenes muy bien. Se probó con una factura sintética de 15 items en tres caminos:

| Camino                                       | Tiempo | Costo real por factura |
| -------------------------------------------- | ------ | ---------------------- |
| Texto (Tesseract) → qwen3.6-35b              | 58.0s  | ~$0.00156              |
| Texto (Tesseract) → gpt-4o-mini              | 8.9s   | ~$0.00056              |
| Imagen directa → gpt-4o-mini (sin Tesseract) | 9.8s   | ~$0.00455              |

Conclusión: **la lentitud reportada no era del pipeline de OCR local — era del modelo de texto (qwen)**. Con el mismo texto ya extraído por Tesseract, `gpt-4o-mini` es prácticamente tan rápido como mandar la imagen directa (8.9s vs 9.8s), pero ~8x más barato (la imagen consume ~23x más tokens de prompt que el texto equivalente por la codificación de imagen en sí — "más barato por token" no es lo mismo que "más barato por factura"). Se descarta el pivot a visión-por-defecto: **se cambia únicamente el default de `OPENROUTER_MODEL` a `openai/gpt-4o-mini`** (antes `qwen/qwen3.6-35b-a3b`), manteniendo intacta la arquitectura de la Decisión 5 (Tesseract primero, visión como fallback condicional). Esto da la mejora de velocidad esperada sin rediseñar el pipeline ni pagar el costo de imagen en el caso común.

Dato adicional que valida el margen del umbral: al costo real medido, 400 facturas/mes (tope del plan Enterprise) escalando a visión el 100% de los casos costarían ~$1.82/mes — insignificante a esta escala. No hace falta ser conservador con `OCR_VISION_FALLBACK_THRESHOLD` por miedo al costo; el riesgo de ese umbral es UX (latencia si escala de más), no presupuesto.

### Decisión 6: `atributosExtra` en `Producto` es genérico y compartido por los 3 flujos de escritura, no exclusivo de OCR

**Elección**: un único punto de extensión en `createProductoBaseSchema` (`src/lib/validators/producto.ts:20-35`), sin ramas por origen (manual vs. OCR) ni por rubro. La UI de los diálogos de producto reusa `RUBRO_ATRIBUTOS_TIPICOS` (la misma tabla que ya alimenta el prompt, Decisión 1) únicamente como sugerencia de qué clave escribir a continuación — nunca como un formulario distinto por rubro.

**Alternativas consideradas**:

- Columnas dedicadas por atributo común (`Producto.talle`, `Producto.color`, `Producto.lote`, `Producto.imei`, ...).
- Un formulario de producto distinto por rubro (`FarmaciaProductoForm`, `IndumentariaProductoForm`, ...).
- Dejar `atributosExtra` como algo que solo la OCR puede escribir, sin exponerlo en los diálogos manuales.

**Justificación**: columnas dedicadas por atributo repiten exactamente el problema que esta propuesta busca evitar — cada rubro nuevo (y ya pasamos de 9 a 17 en esta misma conversación) exigiría otra migración y otra columna, la mayoría `NULL` para el 90% de los productos que no son de ese rubro. Un formulario distinto por rubro va directo contra "no quiero perfiles OCR extremadamente complejos" y multiplica por 17 la superficie de UI a mantener. Dejar `atributosExtra` solo-OCR crea una asimetría rara: un producto creado desde una factura puede tener "lote", pero el mismo producto editado a mano no puede agregárselo ni corregírselo — eso rompe la expectativa básica de que el catálogo es una sola fuente de verdad editable, sin importar cómo se creó el producto originalmente.

### Decisión 7: columnas dinámicas de tabla por selección manual del usuario, no por detección automática

**Elección**: `Configuracion.columnasAtributosProducto String[]` — el usuario elige explícitamente, desde un selector de columnas en `productos-view.tsx`, qué claves de `atributosExtra` quiere ver como columna. `RUBRO_ATRIBUTOS_TIPICOS[rubroNegocio]` aparece como sugerencia dentro de ese selector, no se activa solo.

**Alternativas consideradas**:

- Detección automática: promover a columna cualquier clave que aparezca en más de cierto % de los productos del catálogo, sin que el usuario elija nada.
- Columnas fijas por rubro (ej. rubro=indumentaria siempre muestra "Talle"/"Color" como columnas, hardcodeado).
- Un producto "padre" con variantes (talle/color) como filas hijas, resolviendo la necesidad de forma distinta.

**Justificación**: la detección automática introduce comportamiento impredecible — la tabla cambiaría de forma sola a medida que el usuario carga productos, sin que él lo haya pedido, además de que el umbral de "cuánto % alcanza" es un número arbitrario difícil de justificar. Columnas fijas por rubro reintroduce exactamente el problema que ya se descartó en la Decisión 6 (una vez por rubro, mantenimiento que crece con cada rubro nuevo) — y además asume que todos los productos de un catálogo son 100% del rubro declarado, cuando en la práctica (kiosco que vende de todo, o un comercio que vende accesorios variados) el catálogo real no es homogéneo. El sistema de variantes es un cambio de arquitectura mucho más profundo (afecta `Producto`, `StockSucursal`, `VentaDetalle`, `ConsignacionDetalle` — todo lo que hoy asume 1 fila = 1 SKU) y no resuelve un problema distinto al que se está resolviendo acá (ver _nota_ al final de esta sección); se deja fuera explícitamente. La selección manual, en cambio, es predecible, no depende de umbrales arbitrarios, y el usuario mantiene control total sobre su propia vista — el mismo principio que ya se aplicó a `atributosExtra` en sí (sugerido, nunca forzado).

**Nota sobre variantes**: esta propuesta _no_ resuelve "quiero ver todos los talles de la Remera Básica agrupados en una ficha" — solo resuelve "quiero distinguir de un vistazo, en la lista plana de productos, cuál fila es talle M/Azul y cuál es L/Rojo". Son problemas relacionados pero distintos; el segundo (variantes reales) queda fuera de esta propuesta y ameritaría su propio documento de diseño si se decide encararlo.

### Decisión 8: el fallback de visión cuenta como 1 unidad del cupo de OCR, igual que texto-only

**Elección**: `checkFacturaOcrLimit()` (`src/lib/subscriptions/require-subscription.ts:88`) no cambia — 1 factura procesada consume 1 unidad de `PlanLimit.maxFacturasOcr`, sin importar si terminó usando visión o no. Se agrega logging (`usedVision: boolean` en el log ya existente de `openrouter-client.ts`) para poder revisar con datos reales cuánto pesa esto en costo antes de tocar la política de cupo.

**Alternativas consideradas**:

- Cobrar 2 (o N) unidades de cupo cuando se usa visión, reflejando el costo real mayor.
- Restringir el fallback de visión a planes superiores (ej. solo Enterprise), similar a cómo `maxFacturasOcr` ya distingue planes (0 para Básico/Pro, 400 para Enterprise).
- Un cupo separado y propio para "extracciones con visión".

**Justificación**: cualquiera de las alternativas requiere saber de antemano cuál es el costo real del fallback en producción — dato que hoy no existe (es una funcionalidad nueva). Tomar esa decisión sin datos es adivinar, y adivinar mal en cualquier dirección tiene costo: cobrar de más frena a un usuario legítimo cuya factura vino borrosa por una foto de celular (no por su culpa); cobrar de menos puede exponer a un costo de OpenRouter impredecible si el umbral de confianza resulta más laxo de lo esperado en la práctica. La Decisión 5 ya dejó el umbral de escalamiento como variable de entorno ajustable precisamente para poder calibrar con uso real — esta decisión sigue el mismo criterio: lanzar simple, medir, y recién ahí decidir si hace falta una política de cupo distinta. El logging (punto 14 del Alcance) es lo que hace que esta no sea una decisión "para siempre", sino una de arranque.

### Rubros iniciales propuestos

Reemplaza la lista inicial de 9 (perfumería/supermercado/mayorista salen, se suman las verticales reales del producto: panadería, carnicería, verdulería, electrónica, pet shop, zapatería, gimnasio, veterinaria, peluquería, bar/cervecería, heladería). 17 rubros + "Otro", con slugs estables (no traducidos, para no romper si se cambia el label mostrado). La columna "Atributos típicos" no es un campo nuevo ni una rama de schema — es directamente el contenido que va a completar el bloque de contexto del prompt (Decisión 1) para cada rubro, así no queda inventado a mano:

| Slug             | Label UI           | Atributos típicos (contenido del hint)                        |
| ---------------- | ------------------ | ------------------------------------------------------------- |
| `kiosco`         | Kiosco             | — (sin atributos específicos más allá de los campos estándar) |
| `almacen`        | Almacén            | cuenta corriente / fiado de clientes                          |
| `farmacia`       | Farmacia           | lote, vencimiento, stock mínimo por medicamento               |
| `ferreteria`     | Ferretería         | unidad de medida, marca                                       |
| `indumentaria`   | Indumentaria       | talle, color                                                  |
| `panaderia`      | Panadería          | venta por peso, producción diaria                             |
| `carniceria`     | Carnicería         | venta por kilo, tipo de corte                                 |
| `verduleria`     | Verdulería         | venta por kilo o por unidad                                   |
| `electronica`    | Electrónica        | marca, modelo, IMEI/número de serie                           |
| `pet_shop`       | Pet Shop           | tipo de producto (alimento/accesorio/veterinario)             |
| `zapateria`      | Zapatería          | número (talle de calzado), color                              |
| `libreria`       | Librería           | — (alta rotación estacional, sin atributos fijos extra)       |
| `gimnasio`       | Gimnasio           | membresía vs. venta de suplementos (mixto servicio/producto)  |
| `veterinaria`    | Veterinaria        | medicamentos, consultas registradas como ítem                 |
| `peluqueria`     | Peluquería         | servicios + productos de cabello (mixto servicio/producto)    |
| `bar_cerveceria` | Bar / Cervecería   | bebidas, stock por barril/botella                             |
| `heladeria`      | Heladería          | venta por kilo o unidad, sabores                              |
| `otro`           | Otro (especificar) | texto libre, sin hint predefinido                             |

Cuando el usuario elige "Otro", se guarda el texto libre que escriba directamente en `rubroNegocio` (sin columna adicional) — el prompt usa ese texto tal cual como contexto, sin la lista de "atributos típicos" (esa lista solo existe para los 17 rubros fijos). Si el campo queda vacío (usuario nunca pasó por Setup con esta versión, o lo dejó en blanco), el comportamiento es el actual sin cambios.

Nota: varios de estos rubros (Gimnasio, Veterinaria, Peluquería) son negocios mixtos servicio+producto — el hint no cambia el pipeline para ellos, solo ayuda a que la IA no descarte una fila que combine, por ejemplo, "Corte de pelo" junto con "Shampoo 500ml" en la misma factura de proveedor de insumos.

## Áreas Afectadas

| Área                                                                | Impacto                       | Descripción                                                                                                                                                                                                                         |
| ------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                                              | Modificado                    | `Configuracion.rubroNegocio String?`; `Configuracion.columnasAtributosProducto String[] @default([])`; `FacturaProveedorItem.atributosExtra Json?`; `Producto.atributosExtra Json?`                                                 |
| `prisma/migrations/`                                                | Nuevo                         | Migración aditiva (4 columnas, sin backfill destructivo)                                                                                                                                                                            |
| `src/modules/invoices/config/invoice-extraction.config.ts`          | Modificado                    | `buildInvoiceExtractionPrompt(rubro?)` acepta contexto opcional; `buildExpectedOutputSchema()` agrega `extraAttributes`; `ExtractedInvoiceItem` agrega `extraAttributes`                                                            |
| `src/lib/ai/invoice-ai-parser.ts`                                   | Modificado                    | `procesarFacturaConIA()` acepta `rubroNegocio` opcional y lo pasa al prompt; `normalizarExtraccion()` normaliza `extraAttributes` a objeto plano                                                                                    |
| `src/app/api/facturas-proveedor/[id]/process/route.ts`              | Modificado                    | Lee `Configuracion.rubroNegocio` de la sucursal de la factura antes de llamar `procesarFacturaConIA()`; persiste `atributosExtra` al crear cada `FacturaProveedorItem`                                                              |
| `src/app/api/facturas-proveedor/items/[id]/create-product/route.ts` | Modificado                    | Copia `atributosExtra` del item al `Producto` creado (si existe)                                                                                                                                                                    |
| `src/app/api/facturas-proveedor/items/[id]/confirm/route.ts`        | Sin cambios en esta iteración | Ver "Fuera del Alcance" — no se mergea `atributosExtra` en producto existente automáticamente (evita pisar datos del catálogo sin que el usuario lo pida explícitamente)                                                            |
| `src/lib/validators/producto.ts`                                    | Modificado                    | `atributosExtra` opcional en `createProductoBaseSchema` — heredado por `createProductoSchema` y `updateProductoSchema`, cubre los 3 flujos (crear manual, editar manual, crear desde OCR) sin duplicar validación                   |
| `src/app/api/productos/route.ts`                                    | Sin cambios de lógica         | El `POST` (línea 210) ya usa `createProductoSchema` — `atributosExtra` pasa a persistirse automáticamente al agregarlo al schema base                                                                                               |
| `src/app/api/productos/[id]/route.ts`                               | Sin cambios de lógica         | El `PUT` (línea 126) ya usa `updateProductoSchema` — mismo caso que arriba                                                                                                                                                          |
| `src/app/(...)/productos/components/create-producto-dialog.tsx`     | Modificado                    | Sección genérica de pares clave-valor para `atributosExtra`, con sugerencias de clave desde `RUBRO_ATRIBUTOS_TIPICOS[rubroNegocio]`                                                                                                 |
| `src/app/(...)/productos/components/edit-producto-dialog.tsx`       | Modificado                    | Mismo componente/sección que en creación, prellenado con el `atributosExtra` existente del producto                                                                                                                                 |
| `src/app/setup/types.ts`                                            | Modificado                    | `SetupFormData.rubroNegocio: string \| null`; `InitializePayload.rubroNegocio?: string`                                                                                                                                             |
| `src/app/setup/components/steps/BusinessStep.tsx`                   | Modificado                    | Selector de rubro (chips/select + campo "Otro")                                                                                                                                                                                     |
| `src/app/api/setup/initialize/route.ts`                             | Modificado                    | Persiste `rubroNegocio` en el `configuracion.upsert()` existente (línea ~361)                                                                                                                                                       |
| `src/app/api/settings/general/route.ts`                             | Modificado                    | `GET`/`PUT` incluyen `rubroNegocio`, mismo patrón que el resto de los campos                                                                                                                                                        |
| `src/app/(system-guard)/(protected)/settings/general/page.tsx`      | Modificado                    | UI para editar rubro post-setup                                                                                                                                                                                                     |
| `src/app/(...)/productos/components/factura-proveedor-dialog.tsx`   | Modificado                    | Mostrar `atributosExtra` del item (solo lectura) si el objeto no está vacío                                                                                                                                                         |
| `src/lib/apiService.ts`                                             | Modificado                    | Tipos actualizados para incluir `rubroNegocio` y `atributosExtra` en los payloads existentes                                                                                                                                        |
| `src/lib/ai/openrouter-client.ts`                                   | Modificado                    | `callOpenRouterJson()` acepta `images?` opcional; arma `content` multimodal y selecciona modelo de visión solo si hay imágenes                                                                                                      |
| `src/lib/ocr/extraer-texto-factura.ts`                              | Modificado                    | Devuelve también el buffer de imagen (liviano, sin el preprocesado grayscale de Tesseract) disponible para el fallback de visión                                                                                                    |
| `.env.example`                                                      | Modificado                    | Nuevas variables `OCR_VISION_FALLBACK_THRESHOLD` y `OPENROUTER_VISION_MODEL` (documentadas, con default sensato)                                                                                                                    |
| `src/app/(...)/productos/components/productos-view.tsx`             | Modificado                    | Columnas dinámicas desde `columnasAtributosProducto` (`TableHead`/`TableCell` extra, línea ~514-522 y ~699 respectivamente); `SortKey` extendido para soportar `attr:{clave}`; mismo tratamiento en `MobileProductCard` como badges |
| `src/app/(...)/productos/components/columnas-producto-picker.tsx`   | Nuevo                         | Popover con checkboxes: claves detectadas en el catálogo actual + sugeridas por `RUBRO_ATRIBUTOS_TIPICOS[rubroNegocio]`; persiste a `Configuracion.columnasAtributosProducto` vía el mismo `PUT /api/settings/general`              |
| `src/lib/subscriptions/require-subscription.ts`                     | Sin cambios de lógica         | `checkFacturaOcrLimit()` (línea 88) sigue contando 1 factura = 1 unidad — se documenta la decisión (Decisión 8), no se toca código                                                                                                  |
| `src/lib/ai/openrouter-client.ts` (log estructurado)                | Modificado                    | El log ya existente (líneas 134-139) suma el campo `usedVision: boolean`                                                                                                                                                            |

## Riesgos

| Riesgo                                                                                                                                                  | Probabilidad                           | Mitigación                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El modelo alucina valores en `extraAttributes` que no están en el texto                                                                                 | Media                                  | El prompt reitera la regla ya existente ("NO inventes datos") aplicada explícitamente a `extraAttributes`; se revisa junto con el resto del item antes de confirmar — nunca escribe stock/costo por sí solo (mismo gate que ya existe para todo el pipeline)                                               |
| Rubro mal elegido en Setup empeora la extracción en vez de mejorarla                                                                                    | Baja                                   | El rubro es un hint aditivo, no restrictivo — el prompt no dice "solo busques esto", dice "prestá atención también a esto". Si el hint no aplica, la IA simplemente no encuentra esas columnas y sigue extrayendo lo estándar igual que hoy                                                                |
| Copiar `atributosExtra` a `Producto` en `create-product` pisa datos si el usuario reprocesa la misma factura                                            | Baja                                   | Es un merge aditivo (`{...existente, ...nuevo}`), nunca un reemplazo total del campo                                                                                                                                                                                                                       |
| Migración de Prisma en Railway                                                                                                                          | Baja                                   | Las 3 columnas son nullable sin default distinto de `null` — aditiva pura, `prisma migrate deploy` sin downtime, mismo patrón ya usado en `20260701060000_add_max_facturas_ocr`                                                                                                                            |
| Costo por request se dispara si el umbral de confianza queda muy laxo (escala a visión más seguido de lo necesario)                                     | Media                                  | Umbral configurable por env var (no hardcodeado), default conservador; loggear cuántas facturas escalan a visión para ajustar el umbral con datos reales antes de que sea un problema de costo                                                                                                             |
| El modelo de visión configurado no soporta imágenes (si alguien cambia `OPENROUTER_MODEL` a uno texto-only y no configura `OPENROUTER_VISION_MODEL`)    | Baja                                   | `OPENROUTER_VISION_MODEL` tiene default propio (`openai/gpt-4o-mini`, vision-capable) independiente de `OPENROUTER_MODEL` — no depende de que el modelo primario también soporte visión                                                                                                                    |
| Imagen de alta resolución infla el costo en tokens de forma impredecible                                                                                | Media                                  | Se comprime/redimensiona (sharp, mismo approach que ya se usa para los thumbnails de inventario) a un ancho máximo antes de mandarla — tope fijo, no la imagen original tal cual sale del upload                                                                                                           |
| Usuarios cargan claves inconsistentes a mano en `atributosExtra` desde el diálogo de producto (ej. "vto" vs "vencimiento" vs "Vencimiento")             | Media                                  | Fuera del alcance de esta iteración resolverlo con normalización automática — se mitiga parcialmente sugiriendo las claves de `RUBRO_ATRIBUTOS_TIPICOS` como placeholder/autocomplete en vez de campo 100% libre; no bloquea el guardado si el usuario escribe otra cosa                                   |
| Exponer `atributosExtra` en los diálogos de producto agranda un formulario que ya tiene muchos campos                                                   | Baja                                   | Sección colapsada/opcional al final del formulario (mismo patrón que la sección de descuento, que ya es opcional y no se muestra expandida por defecto)                                                                                                                                                    |
| Usuario activa demasiadas columnas y la tabla se vuelve horizontalmente inmanejable                                                                     | Media                                  | No hay tope hardcodeado (decisión explícita, ver "Fuera del Alcance"), pero el popover de selección puede sugerir un máximo razonable como guía de UX sin bloquear; en mobile las columnas caen a badges dentro de la card, no se agregan como columnas de tabla                                           |
| Ordenar por una columna dinámica (`attr:{clave}`) con valores `undefined` en algunos productos                                                          | Baja                                   | Mismo tratamiento que hoy tienen los campos opcionales existentes en el comparador de `sorted` (`productos-view.tsx:278-299`) — los `undefined`/`null` van al final, no rompen el sort                                                                                                                     |
| Dos negocios con el mismo rubro usan distinta capitalización o nombre para la misma clave (`"Talle"` vs `"talle"`) y terminan viendo columnas separadas | Baja                                   | El selector de columnas ofrece como candidatas las claves que **ya existen** en el catálogo del propio negocio, no una lista global entre negocios — cada negocio es una base de datos independiente (arquitectura single-tenant), así que no hay colisión entre cuentas distintas                         |
| Cupo de OCR (`maxFacturasOcr`) no distingue costo real: un mes con muchas fotos borrosas cuesta más en OpenRouter sin que el plan lo refleje            | Media                                  | Ver Decisión 8 — se lanza contando 1 factura = 1 unidad de cupo (igual que hoy) y se agrega logging de `usedVision` para decidir con datos reales si hace falta una política distinta más adelante                                                                                                         |
| `rubroNegocio` en texto libre ("Otro") sin tope de longitud infla tokens en cada request de OCR futuro si alguien pega un texto largo                   | Media                                  | Tope de 60 caracteres, validado tanto en el input del Setup/Ajustes como en `PUT /api/settings/general`                                                                                                                                                                                                    |
| El texto libre de `rubroNegocio` se inyecta directo en el system prompt de OpenRouter — superficie teórica de "prompt injection"                        | Baja                                   | Riesgo contenido: es arquitectura single-tenant, cada negocio tiene su propia base de datos y sus propias llamadas a OpenRouter — en el peor caso, un usuario solo podría manipular la extracción de _sus propias_ facturas, nunca las de otro cliente. No se agrega sanitización especial por este motivo |
| En el Setup, el selector de columnas de producto no tiene "claves en uso" para sugerir (catálogo todavía vacío)                                         | Baja (comportamiento esperado, no bug) | Documentado explícitamente: en Setup solo aparecen las sugeridas por `RUBRO_ATRIBUTOS_TIPICOS`; las "claves en uso" se van sumando naturalmente a medida que el usuario carga productos después                                                                                                            |

## Plan de Reversión (Rollback)

1. **Código**: `git revert` de los commits del cambio — ningún archivo existente pierde su forma de comportamiento sin rubro configurado.
2. **Base de datos**: las columnas nuevas son nullable y aditivas; no requieren rollback de datos. Si hiciera falta, `prisma migrate resolve` + migración manual de `DROP COLUMN` (no destructiva para el resto del schema).
3. Con rubro nunca configurado (`null`) o `"otro"`, el comportamiento observable es idéntico al actual — el rollback funcional (sin tocar código) es simplemente no completar el nuevo campo.

## Dependencias

- Ninguna dependencia externa nueva. Reutiliza `Prisma`, `OpenRouter` (ya integrado), y los mismos componentes de UI (`Select`/chips) que ya usa el resto del wizard de Setup.

## Criterios de Éxito

- [ ] Un negocio que nunca configuró rubro (o eligió "Otro" sin texto) tiene exactamente el mismo comportamiento de OCR que antes del cambio.
- [ ] Con rubro "Farmacia" configurado, una factura con columnas de lote/vencimiento las captura en `atributosExtra` del item en vez de perderlas.
- [ ] El rubro es editable desde `/settings/general` y el cambio se refleja en el próximo procesamiento de factura (no requiere reprocesar facturas viejas).
- [ ] `buildExpectedOutputSchema()` sigue siendo un único schema — no existen ramas `if (rubro === "farmacia") return schemaFarmacia`.
- [ ] Crear un producto nuevo desde un item con `atributosExtra` persiste esos atributos en `Producto.atributosExtra`.
- [ ] La migración de Prisma es aditiva y corre limpio con `prisma migrate deploy` sin intervención manual.
- [ ] Una factura con OCR vacío (antes: error directo, factura a `ERROR`) ahora intenta extracción con visión antes de reportar error.
- [ ] Una factura con `confianzaOcr` por debajo del umbral manda texto + imagen en un único llamado a OpenRouter (no dos llamados secuenciales).
- [ ] Una factura con `confianzaOcr` alta (caso común) no manda imagen a OpenRouter — cero cambio de costo/latencia para el caso mayoritario.
- [ ] El umbral de escalamiento a visión es configurable por variable de entorno, no hardcodeado.
- [ ] El modelo usado (texto u visión) queda registrado en `FacturaProveedor.iaModeloUsado` (campo existente, sin columna nueva para esto).
- [ ] Un producto creado a mano (sin pasar por OCR) puede tener `atributosExtra` agregados desde `create-producto-dialog.tsx`.
- [ ] Un producto existente (creado por OCR o a mano) puede editar/corregir su `atributosExtra` desde `edit-producto-dialog.tsx`.
- [ ] Con rubro "Indumentaria" configurado, el formulario de producto sugiere "talle"/"color" como próxima clave a completar en `atributosExtra`, sin forzarlos como campos obligatorios.
- [ ] `createProductoSchema`/`updateProductoSchema` siguen siendo un único schema compartido — no se crea un schema de producto distinto por rubro.
- [ ] Con rubro "Indumentaria" y columnas "talle"/"color" activadas desde el selector, la tabla de productos las muestra como columnas reales, ordenables.
- [ ] Un negocio que nunca activó ninguna columna extra ve la tabla de productos exactamente igual que antes del cambio (7 columnas fijas, sin diferencia visual).
- [ ] El selector de columnas ofrece como candidatas las claves que ya existen en `atributosExtra` del catálogo cargado, no una lista fija hardcodeada por rubro.
- [ ] La preferencia de columnas persiste entre sesiones (guardada en `Configuracion.columnasAtributosProducto`, no solo en estado local del navegador).
- [ ] La vista mobile (`MobileProductCard`) muestra los mismos atributos activados como badges, no como columnas de tabla.
- [ ] Una factura procesada con visión sigue consumiendo exactamente 1 unidad de `PlanLimit.maxFacturasOcr`, igual que una procesada solo con texto.
- [ ] El log estructurado de `callOpenRouterJson()` incluye `usedVision: boolean`, verificable en los logs de Railway sin herramienta adicional.
- [ ] Un `rubroNegocio` de más de 60 caracteres es rechazado tanto en el input de Setup/Ajustes como en `PUT /api/settings/general` (validación en ambas capas, no solo cliente).
- [ ] El reporte PDF de inventario no requiere ningún cambio para este documento — se documenta explícitamente como fuera de alcance, sin cambios de comportamiento en `inventory-report-template.ts`.
