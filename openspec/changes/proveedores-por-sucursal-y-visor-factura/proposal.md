# Propuesta: Proveedores por Sucursal + Visor de Imagen de Factura

## Intención

Dos correcciones sobre el módulo de Proveedores/Facturas:

1. **Hoy `Proveedor` es deliberadamente global** (`prisma/schema.prisma:740-754`, sin `sucursalId`, con el comentario explícito "Global al negocio (sin sucursalId): el aprendizaje de proveedor... se comparte entre todas las sucursales"). Esto fue una decisión consciente en su momento, pero el usuario ahora pide lo contrario: cada sucursal debe tener **sus propios** proveedores, sin verlos ni mezclarlos con los de otra sucursal.
2. **Las facturas no se pueden visualizar.** El archivo original (foto/PDF) se guarda en disco al subir (`upload/route.ts`) y existe una ruta server-side lista para servirlo (`GET /api/facturas-proveedor/[id]/archivo`, gateada por token HMAC de 10 minutos), pero **ningún componente de la UI la consume**. `factura-detalle-dialog.tsx` solo muestra un mensaje ("Imagen original eliminada...") cuando `archivoEliminado === true`, pero cuando el archivo **sí** está disponible (factura aún no confirmada/cancelada) no hay ningún `<img>`/visor — es un gap de UI, no de backend.
3. **Utilidad real de la pestaña "Facturas" (vista global, `proveedores-view.tsx`)**, cuestionada por el usuario ahora que cada proveedor tendrá sus propias facturas — ver análisis en Parte 3.

## Alcance

### Parte 1 — Proveedores por sucursal

1. **`Proveedor.sucursalId Int? @default(1)`** — mismo patrón que `Producto.sucursalId` (`prisma/schema.prisma:246`) y `CategoriaGasto.sucursalId` (`prisma/schema.prisma:723`): nullable con default a la sucursal principal, migración aditiva sin backfill destructivo.
2. **`GET /api/proveedores`**: filtra por `auth.activeSucursalId`, salvo vista global (mismo patrón `isGlobalSucursalView`/`getSucursalWhereClause` que ya usa el resto del código — ver `src/lib/security/sucursalScope.ts`).
3. **`POST /api/proveedores`**: persiste `sucursalId: auth.activeSucursalId` al crear. Bloqueado en vista global igual que `facturas-proveedor/upload` (`isGlobalSucursalView` → 409).
4. **`PATCH`/`DELETE /api/proveedores/[id]`**: verifican que el proveedor pertenezca a la sucursal activa (o vista global) antes de permitir editar/dar de baja — hoy no hay ningún chequeo de pertenencia.
5. **Matching automático de proveedor durante OCR** (`facturas-proveedor/[id]/process/route.ts:96-99`, `prisma.proveedor.findFirst({ where: { nombre: ... } })`): se agrega el filtro `sucursalId: factura.sucursalId` para no auto-asignar a una factura de la Sucursal A un proveedor que en realidad es de la Sucursal B con el mismo nombre.
6. **`@@unique`/índices**: `@@index([sucursalId])` en `Proveedor`, igual que el resto de modelos scopeados por sucursal.

### Parte 2 — Visor de imagen de factura

1. **Nuevo endpoint autenticado por sesión** (no por token HMAC — ese está pensado para el worker de OCR, no para el navegador del usuario) que sirva el archivo cuando `!archivoEliminado`, gateado por `requireAuth` + pertenencia de sucursal (mismo patrón que el resto de rutas de `facturas-proveedor`).
2. **`factura-detalle-dialog.tsx`**: cuando `!factura.archivoEliminado`, renderiza el visor:
   - `archivoMime` empieza con `image/` → `<img>` con zoom/click-to-expand.
   - `archivoMime === "application/pdf"` → `<iframe>`/enlace "Abrir PDF" en pestaña nueva.
3. Mantener el mensaje actual ("Imagen original eliminada...") como estado alternativo cuando `archivoEliminado === true` — no se toca ese caso.

### Parte 3 — ¿Tiene sentido la pestaña "Facturas" (vista global de todas las facturas)?

**Pregunta del usuario**: si cada proveedor va a tener sus propias facturas (visibles desde `/proveedores/[id]`), ¿para qué sirve la pestaña "Facturas" de `proveedores-view.tsx`, que muestra *todas* las facturas subidas con un filtro de proveedor? ¿No es redundante?

**Investigación — no es pura redundancia, cumple dos roles que el detalle de proveedor no puede cumplir:**

1. **`FacturaProveedor.proveedorId` es opcional (`Int?`).** Cuando la IA no detecta el proveedor con certeza durante el OCR, la factura queda con `proveedorId: null` (ver `process/route.ts:94-99`, sólo asigna si hay match exacto por nombre). Esa factura **nunca aparecería** en `/proveedores/[id]` de ningún proveedor, porque `FacturasList` con `proveedorId` fijo filtra estrictamente por ese campo (`facturas-list.tsx:81-85`). La pestaña global (ya scopeada por sucursal vía `buildSucursalWhere` en `GET /api/facturas-proveedor`) es hoy el único lugar donde esas facturas "huérfanas" son visibles y accesibles.
2. **Filtro cruzado por estado, sin importar el proveedor** (ej. "mostrame todas las que quedaron en `ERROR` o `REQUIERE_REVISION` esta semana") — el detalle de proveedor obliga a repetir esa búsqueda proveedor por proveedor.

**Hallazgo más importante, encontrado al rastrear qué se puede *hacer* desde esa pestaña**: `FacturaProveedorDialog` (el diálogo de subida en `/productos`) hace `upload → process → revisión/confirmación de ítems` como una sola sesión síncrona — **no acepta un `facturaId` existente para reabrir una factura**. Y tanto la pestaña global como el detalle de proveedor sólo ofrecen, sobre cada factura, un ícono "Ver" que abre `FacturaDetalleDialog` (**de solo lectura**, sin ninguna acción de confirmar/matchear productos) y un ícono "Cancelar".

**Consecuencia concreta**: si un usuario cierra el diálogo de subida antes de terminar la revisión, o la factura queda en `REQUIERE_REVISION`/`ERROR`/`PENDIENTE` (ej. se subió pero nunca se llamó a `process`), **hoy no hay ninguna forma de retomarla desde ningún punto de la UI** — la única acción posible es cancelarla y perder el trabajo (incluida la imagen, que se borra al cancelar). Esto es independiente de si la pestaña "Facturas" existe o no: es un gap del flujo de revisión, no de la organización de las pestañas.

**Lectura de la pregunta original**: la pestaña no está de más — hoy es la única forma de ver facturas sin proveedor asignado y de auditar por estado entre proveedores. Lo que sí conviene resolver es que, una vez que el usuario entra a ver una factura (desde la pestaña global o desde el detalle de proveedor) en estado `REQUIERE_REVISION`/`ERROR`, pueda **retomar la revisión ahí mismo** en vez de sólo poder mirarla o cancelarla. Eso probablemente signifique dotar a `FacturaDetalleDialog` (o a `FacturaProveedorDialog`) de un modo "reanudar" que cargue una factura existente por `id`, en vez de asumir siempre una subida nueva.

**Sin decidir todavía**: si el fix del flujo de revisión hace innecesaria la pestaña global (por ejemplo, si se decide que reanudar sólo tiene sentido desde el detalle del proveedor una vez que también se resuelve el caso `proveedorId: null` con una asignación manual desde ahí), o si se mantiene tal cual está y sólo se le agrega la acción de reanudar. Queda pendiente de decisión antes de tocar código.

### Parte 4 — Backlog de faltantes encontrados en el módulo (Proveedores + Facturas)

Barriendo el resto del flujo (edición de ítems, confirmación, cancelación, constraints del schema) aparecieron más gaps concretos, más allá de los dos temas centrales de esta propuesta. Los dejo documentados por orden de impacto — ninguno está en el Alcance todavía, es insumo para decidir qué entra y qué queda para después:

1. **No se puede reanudar una revisión interrumpida (ya detallado en Parte 3)** — el más urgente: hoy se pierde trabajo (y la imagen) si no se termina de revisar en la misma sesión.

2. **No hay forma de asignar/corregir el proveedor de una factura ya subida.** Cuando `proveedorId` queda `null` (la IA no detectó el proveedor) o quedó mal asignado, no existe ningún control en la UI para corregirlo después — ni en `FacturaDetalleDialog` (solo lectura) ni en ningún otro lado. Combinado con el punto 1, una factura sin proveedor detectado queda efectivamente huérfana para siempre salvo que se cancele.

3. **No hay botón para reprocesar una factura en estado `ERROR`.** El backend ya lo soporta — `PROCESABLES` en `process/route.ts:27-29` incluye `PENDIENTE` **y** `ERROR` — pero ninguna pantalla ofrece un botón "Reintentar OCR". Es la forma más barata de arreglar el punto 1 para el caso más común (falla de OCR, no de datos).

4. **Sin detección de proveedores duplicados.** `createProveedorSchema` no valida contra proveedores existentes por nombre/CUIT — es fácil terminar con "Distribuidora Sur" y "Distribuidora Sur S.A." como dos filas separadas, cada una con su propio historial de alias/costos partido. Se vuelve más relevante todavía con Parte 1 (proveedores por sucursal): cada sucursal puede recrear el mismo proveedor real con variaciones de nombre.

5. **Sin detección de facturas duplicadas.** No hay `@@unique` sobre `(proveedorId, numeroFactura)` ni ningún chequeo en `upload/route.ts` — se puede subir la misma factura dos veces sin aviso, duplicando stock si ambas se confirman.

6. **Sin historial/estadísticas agregadas por proveedor.** `/proveedores/[id]` muestra nombre, CUIT, moneda y la lista de facturas, pero nada agregado (total comprado, última compra, ticket promedio, cantidad de facturas por estado) — sería el contenido más útil de esa pantalla y hoy no está.

7. **Sin paginación en ninguna de las dos listas** (`GET /api/proveedores` y `GET /api/facturas-proveedor` traen todo con `findMany` sin `take`/`skip`). No es un problema con el volumen actual, pero conviene tenerlo presente antes de que un negocio con muchos años de facturas cargadas empiece a notar la carga lenta.

8. **Costo de Parte 1 sobre el aprendizaje de alias entre sucursales**: hoy `ProductoProveedorAlias` cuelga de `proveedorId` (`@@unique([proveedorId, codigoProveedor])`), y el comentario original de "proveedor global" existía justamente para que el aprendizaje de códigos/alias de un proveedor se comparta entre sucursales. Al scopear `Proveedor` por sucursal (Parte 1), un negocio multi-sucursal que compra al mismo proveedor real desde dos sucursales va a tener que re-enseñarle los alias/códigos a cada copia por separado — es un trade-off directo de la Parte 1, no un bug nuevo, pero vale que quede explícito antes de implementar.

### Fuera del Alcance

- Migrar proveedores existentes entre sucursales (la migración deja todos los proveedores actuales en `sucursalId = 1`; reasignarlos a otra sucursal es una operación manual, no automática).
- Compartir/copiar proveedores entre sucursales (ej. "clonar proveedor a otra sucursal") — si hace falta, es un cambio aparte.
- Tocar la política de borrado del archivo original (`archivoEliminado` al confirmar/cancelar) — sigue igual; el visor solo muestra lo que ya está disponible hoy.
- Extender el token HMAC (`factura-proveedor-token.ts`) para uso desde el navegador — motivo: ese token no lleva identidad de usuario ni chequeo de sucursal, está diseñado para un worker de corta vida (Modal), no para exponerlo en una URL que un usuario podría reenviar.
- `ProductoProveedorAlias` sigue como está (ya cuelga de `proveedorId`, hereda el scoping de sucursal transitivamente sin cambios propios).

## Enfoque

### Decisión 1: `sucursalId` nullable con default, no `NOT NULL` sin default

**Elección**: `sucursalId Int? @default(1)`, replicando exactamente el patrón de `Producto.sucursalId`.

**Alternativa descartada**: `sucursalId Int` obligatorio con migración de backfill explícita.

**Justificación**: es el patrón ya establecido en este proyecto para "scopear algo por sucursal sin romper filas existentes" — migración aditiva pura, sin riesgo de fallar en Railway por filas `NULL`. Los proveedores existentes (creados antes del cambio) quedan en la sucursal 1 (la principal), consistente con cómo ya se comportan `Producto` y `CategoriaGasto`.

### Decisión 2: filtrar, no duplicar — reusar `sucursalScope.ts`

**Elección**: usar `isGlobalSucursalView(auth)` + `auth.activeSucursalId` en `GET`/`POST`/`PATCH`/`DELETE /api/proveedores`, igual que ya hace `facturas-proveedor/upload/route.ts` y el resto de endpoints scopeados.

**Justificación**: es el mecanismo único y ya probado en el proyecto para este tipo de scoping — no hay razón para inventar una variante nueva para Proveedor.

### Decisión 3: visor de imagen usa sesión, no el token HMAC existente

**Elección**: nuevo endpoint (o el mismo `/api/facturas-proveedor/[id]/archivo` con una segunda vía de auth) que acepta la sesión de usuario normal en vez de `?token=`.

**Alternativa descartada**: generar un `generateFacturaArchivoToken()` desde el cliente y pasarlo por query string al `<img src>`.

**Justificación**: el token actual es explícitamente "sin credenciales de sesión" y de 10 minutos, pensado para que un worker externo (Modal) descargue el archivo una vez. Usarlo desde el navegador significa que la URL de la imagen (con el token embebido) queda en el DOM/historial y cualquiera con esa URL accede al documento sin sesión durante la ventana de validez — aceptable para un worker efímero, no para exponerlo en una pantalla que el usuario puede inspeccionar o compartir por error. Reusar `requireAuth()` (como ya hace el resto de rutas de facturas) evita ese problema sin infraestructura nueva.

## Áreas Afectadas

| Área | Impacto | Descripción |
|---|---|---|
| `prisma/schema.prisma` | Modificado | `Proveedor.sucursalId Int? @default(1)` + relación a `Sucursal` + `@@index([sucursalId])` |
| `prisma/migrations/` | Nuevo | Migración aditiva (1 columna nullable con default) |
| `src/app/api/proveedores/route.ts` | Modificado | `GET` filtra por sucursal activa (o global); `POST` persiste `sucursalId`, bloqueado en vista global |
| `src/app/api/proveedores/[id]/route.ts` | Modificado | `PATCH`/`DELETE` verifican pertenencia a la sucursal activa antes de modificar |
| `src/app/api/facturas-proveedor/[id]/process/route.ts` | Modificado | Match automático de proveedor por nombre (línea ~96) agrega filtro `sucursalId` |
| `src/lib/validators/proveedor.ts` | Sin cambios de schema | `sucursalId` no se recibe del cliente, se resuelve server-side desde `auth.activeSucursalId` (mismo patrón que `facturas-proveedor/upload`) |
| `src/lib/apiService.ts` | Modificado | Tipo `Proveedor` agrega `sucursalId` |
| `src/app/api/facturas-proveedor/[id]/archivo-sesion/route.ts` (o variante en el mismo archivo) | Nuevo/Modificado | Sirve el archivo gateado por `requireAuth` + pertenencia de sucursal, para consumo desde la UI |
| `src/app/(...)/proveedores/components/factura-detalle-dialog.tsx` | Modificado | Renderiza `<img>`/PDF cuando `!archivoEliminado`, en vez de no mostrar nada |
| `src/app/(...)/proveedores/components/facturas-list.tsx` | Revisar | Confirmar si también debería ofrecer acceso rápido al visor desde la lista, no solo desde el detalle |

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Negocios con una sola sucursal no notan cambio funcional, pero negocios multi-sucursal existentes de golpe "pierden" proveedores que antes veían compartidos | Media | Documentar explícitamente en el rollout; todos los proveedores existentes migran a `sucursalId = 1` (la principal), no desaparecen — quedan visibles solo desde esa sucursal hasta que se reasignen o se creen de nuevo en las demás |
| Facturas históricas con `proveedorId` ya asignado a un proveedor que ahora "pertenece" a otra sucursal (dato inconsistente pre-existente) | Baja | No se toca `FacturaProveedor.proveedorId` retroactivamente — el vínculo ya creado se respeta tal cual, el scoping nuevo solo aplica hacia adelante (alta, listado, match automático) |
| Exponer el archivo original vía endpoint de sesión sin migrar el token HMAC podría duplicar lógica de lectura de archivo | Baja | Reusar la misma función de lectura (`getFacturaProveedorStorageDir` + validación de nombre opaco) que ya usa `archivo/route.ts`, solo cambia la capa de auth |
| Vista global (multi-sucursal) de Proveedores deja de tener sentido si cada sucursal es una isla — ¿debería seguir permitiendo ver "todos" en modo lectura? | Media | Se resuelve con el mismo patrón ya usado en el resto del código (`isGlobalSucursalView` = ve todo en modo solo lectura, no puede crear/editar) — no es un caso nuevo a diseñar |

## Plan de Reversión (Rollback)

1. **Código**: `git revert` de los commits — sin `sucursalId` poblado en el cliente, el comportamiento vuelve a ser "proveedor global" de forma transparente (el filtro simplemente no se aplica).
2. **Base de datos**: columna nueva nullable con default — no requiere rollback de datos; en el peor caso, `DROP COLUMN sucursalId` no afecta el resto del schema.
3. El visor de imagen es aditivo puro (nuevo endpoint + nuevo bloque de UI) — revertirlo no afecta el flujo de subida/procesamiento de facturas existente.

## Dependencias

Ninguna dependencia externa nueva.

## Criterios de Éxito

- [ ] Un usuario en Sucursal A no ve en `/proveedores` los proveedores creados desde Sucursal B (salvo vista global, en modo solo lectura).
- [ ] Crear un proveedor desde Sucursal A lo asigna automáticamente a esa sucursal, sin pedir el campo al usuario.
- [ ] El match automático de proveedor durante el procesamiento OCR de una factura de Sucursal A nunca asigna un proveedor que pertenece a Sucursal B, aunque tengan el mismo nombre.
- [ ] Proveedores existentes antes de la migración siguen siendo editables/visibles desde la sucursal principal, sin que se pierdan datos.
- [ ] Una factura con `archivoEliminado === false` muestra la imagen/PDF original en `factura-detalle-dialog.tsx`.
- [ ] Una factura con `archivoEliminado === true` sigue mostrando el mensaje actual, sin intentar cargar un archivo que ya no existe.
- [ ] El nuevo endpoint de visor rechaza acceso a un usuario sin sesión o de una sucursal distinta a la de la factura (salvo vista global).
