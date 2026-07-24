# Propuesta de Feature: carga de factura con IA en Pedidos Esperados

## Estado

Documentado para planificación futura. No implementado. Requiere decisión del usuario en "Decisiones de diseño abiertas" antes de arrancar.

## Contexto

Hoy existen dos sistemas completamente desconectados en el repo:

### 1. Pedidos Esperados (`/pedidos-esperados`)

Módulo de planificación de reposición de stock, sin proveedor ni costo. Modelo (`prisma/schema.prisma:1041-1072`):

```prisma
model PedidoEsperado {
  id            Int                  @id @default(autoincrement())
  sucursalId    Int
  fechaEsperada DateTime
  observaciones String?
  estado        EstadoPedidoEsperado @default(PROGRAMADO)
  creadoPor     Int
  items         PedidoEsperadoItem[]
}

model PedidoEsperadoItem {
  id               Int              @id @default(autoincrement())
  pedidoId         Int
  productoId       Int              // NOT NULL: siempre referencia un Producto existente
  cantidadEsperada Int
  cantidadRecibida Int              @default(0)
  estado           EstadoItemPedido @default(PENDIENTE)
}
```

Puntos clave:

- **No tiene `proveedorId` ni ningún campo de proveedor.**
- **No tiene precio/costo esperado** — solo cantidades.
- `productoId` es obligatorio: no soporta líneas "sin match" pendientes de creación de producto (a diferencia de facturas).
- Creación manual hoy: `CrearPedidoDialog` (`src/app/(system-guard)/(protected)/pedidos-esperados/components/crear-pedido-dialog.tsx`) — buscador de productos del catálogo propio, cantidad por línea, fecha esperada, observaciones. `POST /api/pedidos-esperados` (`src/app/api/pedidos-esperados/route.ts`), valida con `createPedidoSchema` (`src/lib/validators/pedidos-esperados.ts`).
- Confirmación de llegada (`POST /api/pedidos-esperados/[id]/confirmar`): crea `MovimientoStock` ENTRADA/COMPRA, actualiza `StockSucursal` y `Producto.stockDisponibleUnits`. **Nunca toca costo** (no hay `HistorialCostoProducto` ni `precioCosto` en este flujo).
- Origen: `openspec/changes/pedidos-programados/` (proposal.md, design.md) — la propuesta original explícitamente dejó fuera del MVP la "Importación de pedidos desde archivo CSV o factura del proveedor".

### 2. Carga de factura con IA (`/productos` → `FacturaProveedorDialog`)

Pipeline completo de OCR + IA + matching + registro de costo, pensado para facturas reales de compra. Modelos (`prisma/schema.prisma:775-910`): `FacturaProveedor` (con `proveedorId`, `totalDetectado`, moneda, estado) y `FacturaProveedorItem` (con `productoId` **nullable**, `precioUnitario`, `matchScore`, `candidatoGlobal*`, `advertencias`).

Flujo:

1. Upload (`POST /api/facturas-proveedor/upload`) — guarda el archivo en disco, crea `FacturaProveedor` en `PENDIENTE`.
2. Procesamiento (`POST /api/facturas-proveedor/[id]/process`, `src/app/api/facturas-proveedor/[id]/process/route.ts`):
   - `procesarFacturaConIA()` (`src/lib/ai/invoice-ai-parser.ts:86-183`) — **función pura respecto a la DB**: recibe `{ buffer, mimeType, rubroNegocio? }`, extrae texto local (Tesseract/pdf-parse), arma prompt (`invoice-extraction.config.ts`), llama a OpenRouter, valida con Zod, corre validación aritmética determinística (`validar-consistencia-factura.ts`). Devuelve `{ supplier, invoice, items[], warnings, globalConfidence, aiModel, aiUsage, aiRawResponse }`. **No escribe nada en la base.**
   - El caller (`process/route.ts`) recién ahí hace `construirContextoMatching()` + `matchearItem()` por línea (`src/lib/ocr/matching-engine.ts`) contra el catálogo de la sucursal (+ alias de proveedor), consulta opcionalmente `catalogo-global-api` para líneas sin match, y persiste todo (`FacturaProveedor` a `REQUIERE_REVISION` + `createMany` de `FacturaProveedorItem`).
3. Revisión/confirmación por línea (`FacturaProveedorDialog`, `src/app/(system-guard)/(protected)/productos/components/factura-proveedor-dialog.tsx`): confirmar contra producto existente, crear producto nuevo, ignorar, confirmar todo. La confirmación (`src/lib/ocr/aplicar-confirmacion.ts`) es la que efectivamente suma stock y **registra costo** (`Producto.precioCosto`, `HistorialCostoProducto`, `ProductoProveedorAlias`).

### Punto de contacto entre ambos sistemas

**No existe ninguno hoy.** `FacturaProveedor` se relaciona con `Sucursal` y `Proveedor`; `PedidoEsperado` solo con `Sucursal`. El único contacto indirecto es que ambos `Item` apuntan a `Producto`. No hay `pedidoEsperadoId` en facturas ni `facturaProveedorId`/`proveedorId` en pedidos. Ninguno de los openspec changes existentes (`mejora-precision-lineas-factura-ocr`, `catalogo-global-api`) menciona `PedidoEsperado`.

La lógica de "confirmar y sumar stock" está además duplicada entre `pedidos-esperados/[id]/confirmar/route.ts` y `aplicar-confirmacion.ts` (mismo patrón: upsert `StockSucursal`, `MovimientoStock` ENTRADA/COMPRA, sync `Producto.stockDisponibleUnits`), con nombres y firmas distintas.

## Objetivo

Agregar en `/pedidos-esperados` una forma de crear un pedido esperado a partir de una foto/PDF de factura o remito del proveedor, usando el mismo motor de IA que ya existe (`procesarFacturaConIA` + `matching-engine`), para no tener que buscar y cargar producto por producto a mano cuando se sabe de antemano qué va a llegar.

Importante: esto **no es** "traer el flujo de facturas a pedidos esperados". Pedido Esperado no modela proveedor ni costo — la integración debe respetar eso y no forzar esos conceptos donde no existen en el modelo actual.

## Decisiones de diseño abiertas (pendientes de confirmar con el usuario)

### Decisión 1 — ¿Se persiste una factura o es efímero?

- **Opción A (recomendada)** — Efímero, sin crear `FacturaProveedor`: el archivo se sube solo para que la IA lo lea (`procesarFacturaConIA`), se extraen ítems y cantidades, se resuelve un `productoId` sugerido por línea (reusando `matchearItem`/`construirContextoMatching` en modo solo-lectura, sin persistir), y el resultado prellena el formulario existente de "Nuevo Pedido" (mismo estado `itemsSeleccionados` que ya maneja `CrearPedidoDialog`). Nada se guarda en la base hasta que el usuario aprieta "Crear Pedido" (que sigue siendo el mismo `POST /api/pedidos-esperados` de siempre, sin tocar su contrato). No requiere migración de Prisma. No genera archivos huérfanos en disco (el buffer se procesa en memoria y se descarta).
- **Opción B** — Crear `FacturaProveedor` real vinculada al `PedidoEsperado` nuevo (requiere agregar `pedidoEsperadoId` opcional al schema, con migración). Da trazabilidad de "qué factura originó este pedido" y reutiliza el archivo guardado, pero mezcla dos conceptos que hoy están deliberadamente separados (pedido sin costo/proveedor vs. factura con costo/proveedor) y agranda el alcance (migración, UI de revisión de costos que no aplica acá).

**Recomendación: Opción A.** Menor blast radius, no toca el schema, coherente con que Pedido Esperado nunca tuvo (ni necesita) proveedor/costo. Si en el futuro se necesita trazabilidad "factura → pedido", se puede resolver por separado sin deuda técnica (ej. mencionarlo en `observaciones` con el número de factura y proveedor detectado, que sí vienen en el resultado de la IA aunque no se persistan como relación formal).

### Decisión 2 — Ítems sin coincidencia en el catálogo

`PedidoEsperadoItem.productoId` es NOT NULL, así que toda línea extraída necesita resolver a un producto antes de poder agregarse.

- **Opción A (recomendada)** — Ofrecer "Crear producto" inline por línea sin match, reusando `CreateProductoDialog` (ya usado en `CrearPedidoDialog` para alta manual) precargado con el nombre detectado por la IA. Al crearlo, se agrega automáticamente al pedido con la cantidad detectada. Mismo patrón ya validado en `FacturaProveedorDialog`.
- **Opción B** — Solo listar la línea como advertencia ("sin coincidencia: <texto original> x<cantidad>") sin acción rápida; el usuario la resuelve a mano con el buscador manual ya existente en el dialog.

**Recomendación: Opción A**, por consistencia con el flujo de facturas ya existente y porque reduce fricción real (evita que el usuario tenga que recordar y re-teclear cada línea sin match).

## Alcance propuesto (asumiendo Decisión 1 = Opción A, Decisión 2 = Opción A)

### Backend

- Nuevo endpoint `POST /api/pedidos-esperados/extraer-ia` (nombre tentativo):
  - Auth `requireAuth` + `requireRole(["ADMIN"])`, igual que el resto del módulo. Rechaza en vista global (igual que `POST /api/pedidos-esperados`).
  - Recibe `multipart/form-data` con el archivo (reusar validación de `validateUploadCandidate` de `src/lib/uploads/uploads.ts`, o una versión acotada — no necesita persistir en disco).
  - Lee `Configuracion.rubroNegocio` de la sucursal activa (mismo hint de prompt que usa `process/route.ts`).
  - Llama `procesarFacturaConIA({ buffer, mimeType, rubroNegocio })` — **reutilizado tal cual, sin modificar**, ya que es DB-independiente por diseño (`src/lib/ai/invoice-ai-parser.ts:81-84`).
  - Si `status === "error"`, responde 422 con el mensaje (mismo patrón que `process/route.ts`).
  - Construye `construirContextoMatching({ sucursalId, proveedorId: null })` (sin proveedor: Pedido Esperado no lo tiene) y corre `matchearItem()` por línea — **solo lectura**, no escribe `ProductoProveedorAlias` ni nada.
  - Devuelve por línea: `{ textoOriginal, cantidad, productoId, productoNombre, matchScore, estado, confianzaExtraccion }`, más `{ proveedorNombreDetectado, numeroFactura, warnings }` a nivel factura, para que el frontend pueda sugerir un texto de `observaciones` (ej. `"Según factura N° X de Proveedor Y"`).
  - No crea `FacturaProveedor`, no persiste el archivo, no escribe stock ni costo.
- Sin cambios de schema Prisma, sin migración.
- Considerar el mismo chequeo de cupo de plan que usa `checkFacturaOcrLimit` en `upload/route.ts`, si esta llamada a IA cuenta contra el mismo límite de uso (a definir — ver Preguntas Abiertas).

### Frontend

- `CrearPedidoDialog` (`crear-pedido-dialog.tsx`) gana una segunda forma de poblar `itemsSeleccionados` (el mismo estado que ya existe), sin duplicar la sección final de "Productos seleccionados / Fecha / Observaciones / Submit":
  - Agregar un selector simple arriba del buscador actual: "Buscar productos" (flujo manual actual, default) vs. "Cargar factura (IA)".
  - Tab IA: input de archivo (imagen/PDF, reusar patrones de selección de `factura-proveedor-dialog.tsx` — cámara en mobile, drag&drop en desktop) + botón "Analizar con IA" que llama al nuevo endpoint, con estado de carga (el análisis puede tardar varios segundos, igual que en facturas).
  - Resultado: tabla de líneas extraídas, cada una con cantidad editable, badge de estado de matching (mismos badges/colores que ya existen conceptualmente en `factura-proveedor-dialog.tsx`), y:
    - Si matcheó producto → fila lista para agregar (o ya agregada, con opción de quitar).
    - Si no matcheó → botón "Crear producto" (`CreateProductoDialog` precargado) o dropdown para asignar manualmente un producto existente.
  - Al confirmar la revisión, las líneas resultantes se insertan en `itemsSeleccionados` con la misma forma que ya usa el flujo manual (`{ productoId, nombre, sku, cantidadEsperada, imagenUrl }`), y el usuario cae en la misma UI de siempre (ajustar cantidades, fecha esperada, observaciones, "Crear Pedido").
  - Prellenar `observaciones` (editable) con el proveedor/número de factura detectado, ya que es la única forma de dejar ese dato sin tocar el schema (Decisión 1 = Opción A implica no persistir proveedor en la relación).

## Riesgos y mitigaciones

| Riesgo                                                                                                                                         | Mitigación                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Costo de IA (OpenRouter) por cada intento de "cargar con IA", incluso si el usuario después no crea el pedido                                  | Mismo costo/latencia que ya existe hoy en facturas; no es un riesgo nuevo, es el mismo trade-off ya aceptado en `/productos`. Evaluar si debe contar contra el mismo límite de plan (`checkFacturaOcrLimit`).                                                                                           |
| Duplicar lógica de matching/UI ya escrita para facturas                                                                                        | Se reutiliza `procesarFacturaConIA` y `matchearItem`/`construirContextoMatching` sin modificarlos — el único código nuevo es el endpoint (orquestación) y la UI de revisión, que puede compartir componentes visuales (badges de estado) con `factura-proveedor-dialog.tsx` si se extraen a algo común. |
| Usuario sube una factura real de compra (con costos) esperando que se registre el costo, y no pasa nada porque Pedido Esperado no maneja costo | Dejar explícito en la UI (copy) que esto es para _planificar_ la llegada, no para registrar la compra — el registro de costo real sigue siendo por `/productos` → "Cargar por factura" cuando la mercadería efectivamente llega.                                                                        |
| Archivo temporal en memoria para requests grandes (fotos de alta resolución)                                                                   | Mismo límite de tamaño que ya aplica en `validateUploadCandidate` para `upload/route.ts` de facturas.                                                                                                                                                                                                   |

## Preguntas abiertas

- [ ] ¿Este uso de IA debe contar contra el mismo límite de plan (`checkFacturaOcrLimit`) que la carga de facturas en `/productos`, o debe tener su propio contador/quedar sin límite?
- [ ] ¿Vale la pena, a futuro, agregar `proveedorId` opcional a `PedidoEsperado` para poder filtrar "pedidos esperados de este proveedor" y prellenarlo automáticamente con el proveedor detectado por la IA? (Fuera de alcance de esta propuesta si se elige Decisión 1 = Opción A, pero queda anotado porque la IA ya detecta ese dato y hoy se perdería.)
- [ ] ¿Se quiere permitir cargar más de un archivo por pedido (ej. remito de varias páginas) en la primera versión, o alcanza con uno solo como hoy hace `factura-proveedor-dialog.tsx`?
- [ ] La lógica de "confirmar y sumar stock" está duplicada entre `pedidos-esperados/[id]/confirmar/route.ts` y `aplicar-confirmacion.ts` — ¿unificarla es prerequisito de esta feature o un refactor aparte, sin relación?

## Áreas del repo a impactar (referencia inicial)

- `src/app/api/pedidos-esperados/extraer-ia/route.ts` — nuevo endpoint.
- `src/app/(system-guard)/(protected)/pedidos-esperados/components/crear-pedido-dialog.tsx` — agregar tab/selector IA, reusar `itemsSeleccionados`.
- Posible componente nuevo compartido para la tabla de revisión de líneas IA (si se decide no duplicar el patrón visual de `factura-proveedor-dialog.tsx`).
- Sin cambios en `prisma/schema.prisma` (asumiendo Decisión 1 = Opción A).
- Sin cambios en `src/lib/ai/invoice-ai-parser.ts` ni `src/lib/ocr/matching-engine.ts` (se reutilizan tal cual).
