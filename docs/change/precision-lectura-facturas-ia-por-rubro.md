# Precisión de lectura de facturas por IA — medición de consumo y tasa de error por rubro

## Estado

- **Hecho (sesión 1):** snapshot congelado del valor original de la IA + rubro por factura. Ver "Feature 1" abajo.
- **Planificado, no implementado (sesión 2):** reporte de tasa de error por rubro. Ver "Feature 2" abajo — el plan detallado ya está escrito, falta ejecutarlo.
- **No empezado:** reporte de costo en USD a partir de `iaTokensUsados`. Ver "Feature 3".
- **Pendiente aparte, no bloqueante:** drift de migraciones preexistente en la base de Railway. Ver "Hallazgo colateral" al final.

## Contexto

Objetivo de fondo: medir el consumo de OpenRouter (tokens/costo) y bajar la tasa de errores de lectura de facturas de proveedor en todos los rubros, con el tiempo. `src/lib/ai/openrouter-client.ts` y `src/modules/invoices/config/invoice-extraction.config.ts` ya tenían varias optimizaciones de costo (reasoning "none", `max_tokens` acotado, truncado de OCR, JSON schema strict), pero no había forma de medir si la lectura mejora o empeora, ni de agrupar esa medición por rubro de negocio.

Investigación inicial encontró dos huecos:

1. Cuando el usuario corrige un item durante la revisión (`PATCH /api/facturas-proveedor/items/[id]`) o la cabecera (`PATCH /api/facturas-proveedor/[id]`), se sobreescribía el mismo campo que llenó la IA — se perdía el dato de "qué dijo la IA vs. qué puso el humano".
2. No había dimensión "rubro" en `FacturaProveedor` — `Configuracion.rubroNegocio` es global por sucursal y mutable, no una foto por factura.

Esto se partió en 3 piezas (una por sesión, contrato del repo en `AGENTS.md`):

## Feature 1 — Snapshot IA-original + rubro (HECHO)

Migración `prisma/migrations/20260719120000_add_factura_snapshot_ia_y_rubro/migration.sql`, aplicada con `prisma migrate deploy` contra la base de Railway.

- `FacturaProveedor.rubroNegocio String?` — copia (no referencia) de `Configuracion.rubroNegocio` al momento de procesar. Evita que facturas viejas cambien de categoría si el rubro del negocio cambia después.
- `FacturaProveedor.valoresIaOriginal Json?` — snapshot de cabecera: `{ proveedorNombreDetectado, proveedorCuitDetectado, numeroFactura, fecha, moneda, totalDetectado }`. Shape tipado en `src/lib/validators/factura-proveedor.ts` (`FacturaValoresIaOriginal`, derivado con `.pick()`/`.required()` de `updateFacturaProveedorSchema`).
- `FacturaProveedorItem.valoresIaOriginal Json?` — snapshot de item: `{ textoOriginal, codigoProveedor, cantidad, precioUnitario, totalLinea }`. Tipado en `src/lib/validators/factura-proveedor-item.ts` (`FacturaItemValoresIaOriginal`).

Población: una sola vez, en `src/app/api/facturas-proveedor/[id]/process/route.ts`, con los mismos valores ya normalizados que se insertan en la fila (no el dato crudo de la IA — así el diff futuro contra el campo vivo mide solo corrección humana, no nuestra propia lógica de clamping). Los endpoints `PATCH` de edición **no se tocaron a propósito**: al no escribir nunca sobre estas columnas, quedan congeladas.

Verificado con un script Prisma (`PrismaClient` + `PrismaPg` adapter, transacción con rollback intencional): se creó una factura+item de prueba, se simuló una corrección (`cantidad` 3→5), y `valoresIaOriginal` siguió mostrando 3 — confirma que el snapshot sobrevive a la corrección. Nada quedó persistido (rollback).

**Dato importante para la Feature 2:** todas las facturas procesadas _antes_ de esta migración tienen `rubroNegocio = null` y `valoresIaOriginal = null` — quedan naturalmente excluidas de cualquier cálculo de tasa de error (no hay baseline con qué compararlas). El reporte solo va a mostrar datos a medida que se procesen facturas nuevas.

## Feature 2 — Reporte de tasa de error por rubro (PLANIFICADO, no implementado)

Plan completo ya escrito (ver detalle abajo). Responde directamente "¿las facturas tienen cada vez menos errores de lectura, en todos los rubros?" comparando `valoresIaOriginal` vs. el campo vivo.

### 1. Lógica de agregación — `src/lib/facturas-proveedor/precision-logic.ts` (nuevo)

Mismo patrón que `src/lib/dashboard/kpi-logic.ts` (agregación separada del route handler). `getPrecisionFacturas(auth: SucursalAuthContext)`:

- Scope por sucursal con `buildSucursalWhere(auth)` (`src/lib/security/sucursalScope.ts`), igual que `GET /api/facturas-proveedor/route.ts:26-39`.
- `FacturaProveedor.findMany` con `valoresIaOriginal: { not: Prisma.DbNull }`.
- Validar cada snapshot leído con `facturaValoresIaOriginalSchema.safeParse()` / `facturaItemValoresIaOriginalSchema.safeParse()` (ya existen) — si no parsea, se excluye esa fila en vez de romper el reporte.
- Comparación:
  - Texto (`textoOriginal`, `codigoProveedor`, `proveedorNombreDetectado`, `proveedorCuitDetectado`, `numeroFactura`, `moneda`): diff si `(valor ?? "").trim() !== (original ?? "").trim()`.
  - Número (`cantidad`, `precioUnitario`, `totalLinea`, `totalDetectado`): `Decimal` → `Number`, diff si `Math.abs(a - b) > 0.01`.
  - Fecha: `factura.fecha?.toISOString().slice(0,10) ?? null` vs `original.fecha`.
- Agregación en dos niveles:
  - **Por item, agrupado por rubro** (`rubroNegocio ?? "sin_rubro"`): facturas evaluadas, items evaluados, items con ≥1 corrección, tasa de error.
  - **Por campo, global** (no por rubro, para no diluir la muestra): tabla de 5 campos de item + tabla de 6 campos de cabecera, cada una con evaluados/corregidos/tasa.
- Redondeo: 1 decimal (no hay convención previa en `docs/KPI_CALCULATIONS.md`; documentar ahí al implementar).
- `rubroLabel` sale de `getRubroLabel()` (`src/modules/invoices/config/rubros.ts`, ya existente).

### 2. Endpoint — `src/app/api/facturas-proveedor/reportes/precision/route.ts` (nuevo)

`GET`, `requireAuth()` + `requireRole(auth.user, ["ADMIN"])` (mismo guard que el resto del módulo). Llama a `getPrecisionFacturas(auth)`, devuelve `{ data: ... }`.

### 3. Página — `src/app/(system-guard)/(protected)/proveedores/reportes-ocr/page.tsx` (nuevo)

No hay página standalone de facturas-proveedor hoy (la UI vive embebida en `proveedores/[id]`). Client component:

- Hook `hooks/use-precision-facturas.ts` — fetch + loading/error/refresh, sin filtro de período (foto histórica completa; tendencia temporal queda para después).
- 3 bloques resumen con `Card`/`CardContent` de `@/components/ui/card` (no reusar `KpiCard` del dashboard — evitar acoplar entre route groups): Facturas evaluadas, Items evaluados, Tasa de error global.
- Tabla "Por rubro" con `@/components/ui/table` (mismo componente que usa `proveedores-view.tsx`).
- Dos tablas "Por campo" (items y cabecera).
- Estado vacío explícito si `facturasEvaluadas === 0` — va a ser el estado real hasta que se procesen facturas nuevas post-Feature-1.
- 403 → "No tenés permisos para ver este reporte", sin romper.

### 4. Entry point

En `src/app/(system-guard)/(protected)/proveedores/components/proveedores-view.tsx`, junto al botón "Nuevo Proveedor" (línea 237-247 al momento de este doc), agregar `Link` a `/proveedores/reportes-ocr` con botón secundario ("Reporte OCR").

### 5. Docs

Agregar entrada en `docs/KPI_CALCULATIONS.md` (formato "Fórmula:" existente) documentando la tasa de error, base de cálculo, tolerancia numérica (0.01) y que el rubro es una copia congelada por factura.

### Verificación planeada

1. `npx tsc --noEmit` y `npm run lint` sobre los archivos tocados.
2. Smoke con script Prisma (adapter `PrismaPg`, mismo patrón que Feature 1): transacción con rollback intencional, crear factura+item con snapshot, corregir un item, correr `getPrecisionFacturas` directamente y confirmar que la tasa de error refleja la corrección — sin depender de facturas reales ya procesadas (todas tienen `valoresIaOriginal = null` hoy).
3. Cargar `/proveedores/reportes-ocr` en el navegador y confirmar que el estado vacío renderiza bien.

## Feature 3 — Reporte de costo USD (NO EMPEZADO)

Convertir `FacturaProveedor.iaTokensUsados` (hoy write-only, nadie lo lee) a costo real por modelo (`iaModeloUsado`), agregado por fecha/rubro. Necesita una tabla de precio-por-modelo (no existe todavía). Sin diseño detallado aún.

## Hallazgo colateral — drift de migraciones en Railway (pendiente, no bloqueante)

Al correr `prisma migrate dev` por primera vez en la sesión de Feature 1, Prisma detectó drift preexistente entre la base de Railway (`yamabiko.proxy.rlwy.net:55320/railway`, la DB de desarrollo local según `.env`) y el historial de migraciones committeado: columnas de `Venta`, `Pago`, `Producto`, `Notification`, `StoreSettings`, `Subcategoria`, `VentaDetalle`, `LiquidacionItem` que ya están en la DB pero no corresponden a ningún archivo de migración en `prisma/migrations/`. Prisma pidió resetear la base (`prisma migrate reset`, con pérdida total de datos) — **no se hizo**.

Se evitó el problema para Feature 1 usando `prisma migrate deploy` en vez de `migrate dev` (deploy solo aplica migraciones pendientes, sin el diff/shadow-DB que dispara el aviso de reset). `prisma migrate status` confirmó "Database schema is up to date!" — las 27 migraciones previas están todas aplicadas y con checksum correcto; el drift es específicamente entre el _schema resultante_ de esas migraciones y el estado real de la tabla, no un problema de historial roto.

Pista fuerte sobre el origen: `package.json` (`build`/`start` scripts) ya tiene un workaround manual — `DELETE FROM _prisma_migrations WHERE migration_name = '20260523120000_add_storefront_content_to_branding'` antes de `migrate deploy` — lo que sugiere que esa migración puntual fue editada después de aplicada (rompiendo su checksum) o que hubo un `prisma db push` en algún momento que actualizó la DB sin generar migración. Vale la pena investigar cuál de los dos pasó y resolverlo de raíz (en vez de acumular más workarounds) una vez terminada la Feature 2 de este documento.
