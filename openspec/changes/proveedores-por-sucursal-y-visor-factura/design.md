# Diseño: Proveedores por Sucursal + Visor de Imagen de Factura

Cubre **Parte 1** y **Parte 2** de `proposal.md` — las dos únicas secciones con Alcance ya cerrado. Las Partes 3 (utilidad de la pestaña "Facturas") y 4 (backlog de faltantes) quedan explícitamente fuera de este diseño: son insumo para decidir prioridades, no fueron aprobadas como trabajo a implementar todavía.

## Análisis de la arquitectura actual (evidencia con file:line)

### Proveedor es global hoy, por decisión explícita anterior

`prisma/schema.prisma:740-754` — `Proveedor` no tiene `sucursalId`. El comentario en `src/app/api/proveedores/route.ts:2-3` lo confirma: _"Global al negocio (sin sucursalId): el aprendizaje de proveedor (alias, códigos, formato de factura) se comparte entre todas las sucursales."_ Los 4 endpoints CRUD (`proveedores/route.ts` GET/POST, `proveedores/[id]/route.ts` PATCH/DELETE) no filtran ni verifican pertenencia por sucursal en absoluto.

`FacturaProveedor`, en cambio, **ya es sucursal-scoped** (`sucursalId Int` no-nulo, `prisma/schema.prisma:759`), y su endpoint de listado ya usa el mecanismo estándar del proyecto:

```typescript
// src/app/api/facturas-proveedor/route.ts:25
const sucursalWhere = buildSucursalWhere(auth);
const facturas = await prisma.facturaProveedor.findMany({ where: { ...sucursalWhere, ... } });
```

### El mecanismo de scoping ya existe y tiene un precedente casi idéntico: `Cliente`

`src/lib/security/sucursalScope.ts` expone las piezas reutilizables:

- `buildSucursalWhere(auth)` → `{}` en vista global, `{ sucursalId: auth.activeSucursalId }` en el resto (línea 125-129).
- `isGlobalSucursalView(auth)` → `true` sólo si `rol === "ADMIN"` y `activeSucursalId === 0` (línea 121-123, delega en `canUseGlobalView` línea 46-48).
- `canAccessSucursalResource(auth, resourceSucursalId)` → `true` en vista global, o si coincide con `auth.activeSucursalId` (línea 131-137).

`Cliente` (`prisma/schema.prisma`, `sucursalId Int`) usa exactamente este patrón end-to-end y es el precedente más directo para lo que necesita `Proveedor`:

- `src/app/api/clientes/route.ts:12-13` — GET filtra con `buildSucursalWhere(auth)`.
- `src/app/api/clientes/route.ts:29-31` — POST bloquea en vista global (409) y persiste `sucursalId: auth.activeSucursalId` (línea 49).
- `src/app/api/clientes/[id]/route.ts:29` — GET verifica `canAccessSucursalResource(auth, cliente.sucursalId)` antes de exponer el recurso, devolviendo 404 (no 403) si no pertenece a la sucursal — evita filtrar la existencia del recurso a quien no tiene acceso.
- `src/app/api/clientes/[id]/route.ts:60-63` y `106-109` — PUT/DELETE bloquean en vista global y verifican `existing.sucursalId !== auth.activeSucursalId` antes de escribir.

`Producto.sucursalId Int? @default(1)` (`prisma/schema.prisma:246`) es el precedente de **columna nullable con default**, para migraciones aditivas sin backfill — se usa cuando el modelo tiene filas preexistentes que no pueden quedar `NULL` de forma indefinida pero tampoco requieren una migración de datos con downtime.

### El match automático de proveedor durante OCR no filtra por sucursal

`src/app/api/facturas-proveedor/[id]/process/route.ts:94-99`:

```typescript
let proveedorId = factura.proveedorId;
if (!proveedorId && resultado.supplier.name) {
  const match = await prisma.proveedor.findFirst({
    where: { nombre: { equals: resultado.supplier.name, mode: "insensitive" } },
  });
  if (match) proveedorId = match.id;
}
```

Sin `sucursalId` en el `where`, hoy esto ya es "correcto" solo porque `Proveedor` es global — en el momento en que se scopea, este `findFirst` **debe** agregar `sucursalId: factura.sucursalId` o de lo contrario un proveedor de la Sucursal A podría auto-asignarse a una factura de la Sucursal B con el mismo nombre.

### El visor de imagen: el backend ya existe, la UI nunca lo llama

`src/app/api/facturas-proveedor/[id]/archivo/route.ts` sirve el archivo (líneas 47-60), pero está gateado por un token HMAC de 10 minutos (`src/lib/security/factura-proveedor-token.ts:15`) generado por `generateFacturaArchivoToken()` — función que **no se llama desde ningún componente de la UI hoy** (`grep` de `generateFacturaArchivoToken` sólo devuelve su propia definición). El comentario del propio archivo lo confirma: _"para casos donde hace falta acceso al documento sin pasar por la sesión normal (ej. visor externo de corta vida)"_ — está diseñado para un consumidor externo (Modal, el worker de OCR), no para el navegador del usuario.

`src/app/(system-guard)/(protected)/proveedores/components/factura-detalle-dialog.tsx:108-113` sólo maneja el caso `archivoEliminado === true` (mensaje "Imagen original eliminada"). Cuando `archivoEliminado === false` no pasa nada — no hay ningún `<img>`/`<iframe>` en el componente.

`GET /api/facturas-proveedor/[id]` (usado por `getFacturaProveedor()` en `apiService.ts:688-690`, que alimenta este diálogo) ya expone `archivoMime` y `archivoEliminado` en su `select`/`include` implícito (`prisma.facturaProveedor.findUnique` sin `select`, trae el modelo completo) — los datos que la UI necesita para decidir qué visor renderizar **ya llegan al cliente hoy**, solo no se usan.

### Política de borrado del archivo (sin cambios, contexto necesario)

`src/lib/ocr/aplicar-confirmacion.ts:260-291` (`purgarArchivoFacturaSiFinalizada`) borra el binario del disco cuando la factura llega a un estado terminal (confirmada completa o cancelada) y marca `archivoEliminado: true`. Esto no se toca — el visor sólo muestra lo que ya está disponible en cada momento, respetando esta política tal cual existe.

## Decisiones de arquitectura

Ver `proposal.md` sección "Enfoque" para las 3 decisiones centrales (Decisión 1: `sucursalId` nullable con default vs. NOT NULL; Decisión 2: reusar `sucursalScope.ts` en vez de un mecanismo nuevo; Decisión 3: visor por sesión, no por el token HMAC existente). Acá se detalla el "cómo".

## Cambios al schema de Prisma

```prisma
model Proveedor {
  id              Int      @id @default(autoincrement())
  nombre          String
  cuit            String?
  monedaPreferida String   @default("ARS")
  activo          Boolean  @default(true)
  sucursalId      Int?     @default(1)   // NUEVO
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  sucursal Sucursal? @relation(fields: [sucursalId], references: [id])  // NUEVO
  facturas FacturaProveedor[]
  alias    ProductoProveedorAlias[]

  @@index([activo])
  @@index([nombre])
  @@index([sucursalId])   // NUEVO
}

model Sucursal {
  // ... campos existentes sin cambios ...
  proveedores Proveedor[]   // NUEVO — lado inverso de la relación
}
```

Una sola columna nullable con default — migración aditiva pura, mismo patrón que `Producto.sucursalId`. Los proveedores existentes quedan en `sucursalId = 1` (la sucursal principal) sin necesidad de un script de backfill: el `@default(1)` de Prisma lo resuelve a nivel de columna (`DEFAULT 1` en el `ALTER TABLE`).

## Parte 1 — Endpoints de Proveedor

### `GET /api/proveedores` — filtrar por sucursal

Diff conceptual sobre `src/app/api/proveedores/route.ts`:

```typescript
import {
  buildSucursalWhere,
  isGlobalSucursalView,
} from "@/lib/security/sucursalScope";

export async function GET(_req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const isGlobal = isGlobalSucursalView(auth);
  const proveedores = await prisma.proveedor.findMany({
    where: { activo: true, ...buildSucursalWhere(auth) },
    orderBy: isGlobal
      ? [{ sucursalId: "asc" }, { nombre: "asc" }]
      : [{ nombre: "asc" }],
  });
  return NextResponse.json(proveedores, {
    headers: {
      "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
    },
  });
}
```

Mismo patrón que `clientes/route.ts:12-16` (orden secundario por `sucursalId` sólo quiebra en vista global, para agrupar visualmente).

### `POST /api/proveedores` — bloquear vista global, persistir `sucursalId`

```typescript
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (isGlobalSucursalView(auth)) {
    return NextResponse.json(
      {
        error:
          "Vista global en modo solo lectura. Selecciona una sucursal para crear un proveedor.",
      },
      { status: 409 },
    );
  }
  // ...validación existente...
  const nuevoProveedor = await prisma.proveedor.create({
    data: {
      nombre: parsed.data.nombre.trim(),
      cuit: parsed.data.cuit?.trim() || null,
      monedaPreferida: parsed.data.monedaPreferida,
      sucursalId: auth.activeSucursalId, // NUEVO
    },
  });
  // ...
}
```

`sucursalId` no se agrega a `createProveedorSchema` (`src/lib/validators/proveedor.ts`) — se resuelve server-side desde `auth.activeSucursalId`, igual que `clientes/route.ts:49` y `facturas-proveedor/upload/route.ts:68`. El cliente nunca puede elegir a qué sucursal pertenece un proveedor que crea.

### `PATCH` / `DELETE /api/proveedores/[id]` — verificar pertenencia

Diff conceptual sobre `src/app/api/proveedores/[id]/route.ts`, mismo patrón que `clientes/[id]/route.ts:60-63`:

```typescript
import {
  canAccessSucursalResource,
  isGlobalSucursalView,
} from "@/lib/security/sucursalScope";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (isGlobalSucursalView(auth)) {
    return NextResponse.json(
      {
        error:
          "Vista global en modo solo lectura. Selecciona una sucursal para editar un proveedor.",
      },
      { status: 409 },
    );
  }
  // ...
  const existing = await prisma.proveedor.findUnique({
    where: { id: proveedorId },
  });
  if (!existing || !canAccessSucursalResource(auth, existing.sucursalId)) {
    return NextResponse.json(
      { error: "Proveedor no encontrado" },
      { status: 404 },
    );
  }
  // ...update existente sin cambios...
}
```

`DELETE` (baja lógica, `activo: false`) recibe el mismo chequeo antes de la línea 94 actual. `GET /api/proveedores/[id]` (línea 8-27, hoy sin auth de sucursal en absoluto) también gana el mismo chequeo de pertenencia — hoy cualquier usuario autenticado puede ver cualquier proveedor por id sin importar la sucursal.

### Match automático de proveedor durante OCR — agregar filtro de sucursal

Diff conceptual sobre `src/app/api/facturas-proveedor/[id]/process/route.ts:94-99`:

```typescript
let proveedorId = factura.proveedorId;
if (!proveedorId && resultado.supplier.name) {
  const match = await prisma.proveedor.findFirst({
    where: {
      nombre: { equals: resultado.supplier.name, mode: "insensitive" },
      sucursalId: factura.sucursalId, // NUEVO
    },
  });
  if (match) proveedorId = match.id;
}
```

Sin este filtro, dos sucursales con un proveedor real homónimo (ej. "Coca-Cola Distribuidora") auto-asignarían la factura de una sucursal al `Proveedor.id` creado por la otra — cruzando el aislamiento que es el objetivo central de la Parte 1.

### `src/lib/apiService.ts` — tipo `Proveedor`

```typescript
export interface Proveedor {
  id: number;
  nombre: string;
  cuit: string | null;
  monedaPreferida: string;
  activo: boolean;
  sucursalId: number | null; // NUEVO
  createdAt: string;
  updatedAt: string;
}
```

Campo solo de lectura desde el cliente — no se agrega a `CreateProveedorInput`/`UpdateProveedorInput` en `src/lib/validators/proveedor.ts`.

## Parte 2 — Visor de imagen de factura

### Nuevo endpoint gateado por sesión

`src/app/api/facturas-proveedor/[id]/archivo/route.ts` hoy sólo acepta `?token=` (HMAC, sin sesión). Se agrega una segunda vía de autenticación **en el mismo archivo** — no un archivo nuevo, para no duplicar la lectura del filesystem ni la validación del nombre opaco:

```typescript
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const facturaId = Number(id);
  if (!Number.isInteger(facturaId)) {
    return NextResponse.json(
      { error: "Factura no encontrada" },
      { status: 404 },
    );
  }

  const token = req.nextUrl.searchParams.get("token");
  let autorizado = verifyFacturaArchivoToken(facturaId, token);

  // NUEVO: segunda vía — sesión de usuario con acceso a la sucursal de la factura.
  if (!autorizado) {
    const auth = await requireAuth();
    if (auth.ok) {
      const factura = await prisma.facturaProveedor.findUnique({
        where: { id: facturaId },
        select: { sucursalId: true },
      });
      autorizado =
        Boolean(factura) &&
        canAccessSucursalResource(auth, factura!.sucursalId);
    }
  }

  if (!autorizado) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // ...resto de la función sin cambios (lectura de archivoPath/archivoMime, readFile, response)...
}
```

Las dos vías coexisten sin interferirse: el worker de OCR sigue usando `?token=` (nunca tiene sesión de usuario), el navegador usa la cookie de sesión existente (sin querystring). `export const dynamic = "force-dynamic"` ya presente (línea 15) sigue siendo necesario para ambas.

### `factura-detalle-dialog.tsx` — renderizar el visor

Diff conceptual, dentro del bloque `{/* Body */}` de `src/app/(system-guard)/(protected)/proveedores/components/factura-detalle-dialog.tsx`, antes de la tabla de ítems:

```tsx
{
  !factura?.archivoEliminado && factura && (
    <div className="mb-4 rounded-2xl border border-border/50 overflow-hidden bg-muted/20">
      {factura.archivoMime.startsWith("image/") ? (
        <a
          href={API_ROUTES.FACTURAS_PROVEEDOR.ARCHIVO(factura.id)}
          target="_blank"
          rel="noreferrer"
        >
          <img
            src={API_ROUTES.FACTURAS_PROVEEDOR.ARCHIVO(factura.id)}
            alt="Factura original"
            className="w-full max-h-72 object-contain hover:opacity-90 transition-opacity cursor-zoom-in"
          />
        </a>
      ) : (
        <a
          href={API_ROUTES.FACTURAS_PROVEEDOR.ARCHIVO(factura.id)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 p-6 text-sm font-medium text-primary hover:underline"
        >
          <FileText className="h-4 w-4" /> Abrir PDF original
        </a>
      )}
    </div>
  );
}
```

No hace falta token en el cliente: el navegador ya manda la cookie de sesión al pedir `<img src="/api/facturas-proveedor/123/archivo">`, la misma que usa para cualquier otra llamada a la API. `API_ROUTES.FACTURAS_PROVEEDOR.ARCHIVO(id)` es una entrada nueva en el objeto de rutas existente (`src/lib/apiService.ts`, junto al resto de `FACTURAS_PROVEEDOR.*`).

Zoom simple vía `target="_blank"` (abre la imagen original a tamaño completo en una pestaña nueva) — sin librería de lightbox nueva, consistente con "no agregar abstracciones más allá de lo que pide la tarea".

### Caso `archivoEliminado === true` — sin cambios

El bloque existente (líneas 108-113 actuales) se mantiene tal cual, como rama alternativa al bloque nuevo de arriba.

## Migraciones

Una sola migración Prisma, aditiva:

```sql
-- AlterTable
ALTER TABLE "Proveedor" ADD COLUMN "sucursalId" INTEGER DEFAULT 1;
CREATE INDEX "Proveedor_sucursalId_idx" ON "Proveedor"("sucursalId");
ALTER TABLE "Proveedor" ADD CONSTRAINT "Proveedor_sucursalId_fkey"
  FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

Sin backfill manual (el `DEFAULT 1` resuelve las filas existentes a nivel de `ALTER TABLE`), sin downtime, aplicable con `prisma migrate deploy`. La Parte 2 no requiere ninguna migración — es aditiva a nivel de código (endpoint + UI), no de schema.

`ON DELETE SET NULL`: si alguna vez se borra una `Sucursal` (hoy no hay ruta de borrado físico de sucursales en el código, sólo baja lógica `activa: false`), un proveedor huérfano queda visible únicamente en vista global en vez de romper la fila — mismo criterio que otras relaciones opcionales de este schema.

## Compatibilidad hacia atrás

1. **Negocio de una sola sucursal**: `sucursalId` queda siempre en `1` para todo — cero cambio de comportamiento observable, el filtro `buildSucursalWhere` no excluye nada porque `activeSucursalId` siempre resuelve a `1`.
2. **Proveedores creados antes de la migración**: quedan en `sucursalId = 1` automáticamente (default de columna) — siguen editables y visibles desde esa sucursal sin acción manual.
3. **Vista global (ADMIN, `activeSucursalId === 0`)**: sigue viendo todos los proveedores de todas las sucursales, en modo solo lectura (no puede crear/editar) — mismo comportamiento que ya tiene con `Cliente` y `FacturaProveedor` hoy.
4. **Facturas ya confirmadas/canceladas antes de este cambio** (`archivoEliminado: true`): el visor de la Parte 2 no intenta cargar nada para ellas — siguen mostrando el mensaje actual sin cambios.

## Riesgos

Ver `proposal.md`. Riesgo técnico adicional identificado en este diseño: la segunda vía de auth en `archivo/route.ts` agrega una consulta a `prisma.facturaProveedor` (`select: { sucursalId: true }`) sólo cuando el token HMAC no está presente o es inválido — no afecta el camino del worker de OCR (que siempre manda `?token=` válido y nunca llega a ejecutar esa consulta).

## Roadmap de Implementación (por fases)

Ambas partes son independientes entre sí — no hay dependencia técnica de una sobre la otra, se listan en el orden del `proposal.md` pero se pueden implementar/deployar en cualquier orden o en paralelo.

### Fase 1 — Proveedores por sucursal

Única fase con migración de Prisma.

1. Migración Prisma: `Proveedor.sucursalId` + relación + índice + `prisma generate`.
2. `src/app/api/proveedores/route.ts`: `GET` filtra con `buildSucursalWhere`; `POST` bloquea vista global y persiste `sucursalId`.
3. `src/app/api/proveedores/[id]/route.ts`: `GET`/`PATCH`/`DELETE` verifican `canAccessSucursalResource`; `PATCH`/`DELETE` bloquean vista global.
4. `src/app/api/facturas-proveedor/[id]/process/route.ts`: filtro `sucursalId: factura.sucursalId` en el match automático por nombre.
5. `src/lib/apiService.ts`: tipo `Proveedor` agrega `sucursalId`.

**Listo cuando**: un usuario en Sucursal A no ve proveedores de Sucursal B (salvo vista global, solo lectura); crear un proveedor lo asigna a la sucursal activa sin pedirlo en el form; el match automático de OCR nunca cruza sucursales; proveedores preexistentes siguen editables desde la sucursal principal.

### Fase 2 — Visor de imagen de factura

Sin dependencia de la Fase 1, sin migración.

1. `src/app/api/facturas-proveedor/[id]/archivo/route.ts`: segunda vía de auth por sesión (`requireAuth` + `canAccessSucursalResource`), coexistiendo con el token HMAC existente.
2. `src/lib/apiService.ts`: entrada `API_ROUTES.FACTURAS_PROVEEDOR.ARCHIVO(id)`.
3. `factura-detalle-dialog.tsx`: bloque de visor (`<img>` o enlace de PDF) cuando `!archivoEliminado`.

**Listo cuando**: una factura con `archivoEliminado === false` muestra la imagen/PDF en el diálogo de detalle; una factura con `archivoEliminado === true` sigue mostrando el mensaje actual; un usuario sin sesión o de otra sucursal no puede acceder al archivo vía el endpoint (sin token ni sesión válida → 403).

---

Cada fase es aditiva y compatible hacia atrás por sí sola. Se puede implementar solo una de las dos sin dejar nada roto ni a medio camino.
