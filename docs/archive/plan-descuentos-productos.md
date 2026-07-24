# Plan de implementación: Descuentos en productos y catálogo

> **ARCHIVADO (2026-06-30): implementado.** `descuentoPorcentaje/Activo/Desde/Hasta` ya están en `prisma/schema.prisma` y la lógica vive en `src/lib/descuento-utils.ts`. Se conserva solo como referencia histórica del diseño original.

## Contexto de la base existente

El sistema ya tiene:

- `Categoria.descuentos` y `Subcategoria.descuentos` — tiers de descuento por cantidad (JSON), con UI en `discount-tiers-inline.tsx`
- `VentaDetalle.descuento` y `Venta.descuentoGlobal` — descuentos en ventas
- `StockSucursal.precioVentaOverride` — precio diferencial por sucursal
- Infraestructura de precios en el catálogo público (`product-card.tsx`, `product-modal.tsx`)

Lo que **falta** es un descuento directo sobre el producto (precio tachado + precio final) visible en el catálogo.

---

## Etapa 1 — Modelo de datos (cambio mínimo)

### Qué se agrega

Un solo bloque en el modelo `Producto` en `prisma/schema.prisma`:

```prisma
model Producto {
  // ...campos actuales...

  descuentoPorcentaje  Decimal?  @db.Decimal(5, 2)   // null = sin descuento
  descuentoDesde       DateTime?                       // null = sin límite inferior
  descuentoHasta       DateTime?                       // null = sin límite superior
  descuentoActivo      Boolean   @default(false)
}
```

**Por qué esta estructura:**

- `descuentoPorcentaje` — el sistema ya usa porcentajes en todos lados (categorías, consignaciones), es consistente.
- `descuentoActivo` — interruptor explícito, independiente de las fechas. Útil para pausar un descuento sin borrarlo.
- `descuentoDesde / Hasta` — vigencia opcional. Si ambos son `null`, el descuento está siempre activo mientras `descuentoActivo = true`.

**Qué se reutiliza:** el resto del modelo `Producto` sin cambios. No se crea ninguna tabla nueva.

### Migración

```bash
npx prisma migrate dev --name add_descuento_producto
```

---

## Etapa 2 — Lógica de negocio y validaciones

### Regla de descuento activo

Un producto tiene descuento efectivo si cumple **todas** estas condiciones:

```
descuentoActivo = true
AND descuentoPorcentaje IS NOT NULL AND > 0
AND (descuentoDesde IS NULL OR now() >= descuentoDesde)
AND (descuentoHasta IS NULL OR now() <= descuentoHasta)
```

Esta lógica se centraliza en una función utilitaria reutilizable:

```typescript
// src/lib/descuento-utils.ts

export type DescuentoEfectivo = {
  porcentaje: number;
  precioOriginal: number;
  precioFinal: number;
};

export function calcularDescuentoEfectivo(
  producto: {
    descuentoActivo: boolean;
    descuentoPorcentaje: number | null;
    descuentoDesde: string | Date | null;
    descuentoHasta: string | Date | null;
    precioVenta: number;
  },
  ahora: Date = new Date(),
): DescuentoEfectivo | null {
  if (!producto.descuentoActivo || !producto.descuentoPorcentaje) return null;

  const desde = producto.descuentoDesde
    ? new Date(producto.descuentoDesde)
    : null;
  const hasta = producto.descuentoHasta
    ? new Date(producto.descuentoHasta)
    : null;

  if (desde && ahora < desde) return null;
  if (hasta && ahora > hasta) return null;

  const porcentaje = Number(producto.descuentoPorcentaje);
  const precioOriginal = Number(producto.precioVenta);
  const precioFinal = precioOriginal * (1 - porcentaje / 100);

  return { porcentaje, precioOriginal, precioFinal };
}
```

### Validaciones a aplicar

- `descuentoPorcentaje` entre 1 y 99 (no puede ser 0% ni 100%)
- `descuentoHasta` debe ser posterior a `descuentoDesde` si ambas están presentes
- `descuentoHasta` no puede ser fecha pasada al momento de guardar (warning, no error bloqueante)

---

## Etapa 3 — Backend: qué exponer

### Tipo actualizado

En `src/lib/types.ts`, extender `Producto`:

```typescript
export type DescuentoEfectivo = {
  porcentaje: number;
  precioOriginal: number;
  precioFinal: number;
};

export type Producto = {
  // ...campos actuales...
  descuentoPorcentaje?: number | null;
  descuentoDesde?: ISODateString | null;
  descuentoHasta?: ISODateString | null;
  descuentoActivo: boolean;
  // Campo calculado por el backend — el frontend nunca recalcula vigencia:
  descuentoEfectivo?: DescuentoEfectivo | null;
};
```

### En la API de productos (`/api/productos`)

En `src/app/api/productos/route.ts`, al mapear cada producto hacia la respuesta, calcular `descuentoEfectivo` en el servidor:

```typescript
import { calcularDescuentoEfectivo } from "@/lib/descuento-utils";

// Al mapear cada producto en el SELECT de Prisma:
const descuentoEfectivo = calcularDescuentoEfectivo({
  descuentoActivo: p.descuentoActivo,
  descuentoPorcentaje: p.descuentoPorcentaje
    ? Number(p.descuentoPorcentaje)
    : null,
  descuentoDesde: p.descuentoDesde,
  descuentoHasta: p.descuentoHasta,
  precioVenta: Number(p.precioVentaOverride ?? p.precioVenta),
});

return {
  ...productoMapeado,
  descuentoEfectivo,
};
```

> **Por qué en el servidor:** el cliente nunca debería recalcular si un descuento está vigente. El backend ya conoce la hora actual y todas las condiciones. El frontend solo consume `descuentoEfectivo` o `null`.

### Validación en schema Zod

En `src/lib/validators/producto.ts`, agregar al schema existente:

```typescript
descuentoPorcentaje: z.number().min(1).max(99).nullable().optional(),
descuentoDesde: z.string().datetime().nullable().optional(),
descuentoHasta: z.string().datetime().nullable().optional(),
descuentoActivo: z.boolean().optional().default(false),
```

Con refinement para validar coherencia de fechas:

```typescript
.refine(
  (data) => {
    if (data.descuentoDesde && data.descuentoHasta) {
      return new Date(data.descuentoHasta) > new Date(data.descuentoDesde);
    }
    return true;
  },
  { message: "La fecha de fin debe ser posterior a la fecha de inicio", path: ["descuentoHasta"] }
)
```

---

## Etapa 4 — Frontend: administración

### Dónde agregar el formulario

En `edit-producto-dialog.tsx` y `create-producto-dialog.tsx`, agregar una sección colapsable "Descuento":

```tsx
{
  /* Sección descuento */
}
<div className="space-y-3 border rounded-lg p-4">
  <div className="flex items-center justify-between">
    <Label className="text-sm font-medium">Descuento</Label>
    <Switch
      checked={form.watch("descuentoActivo")}
      onCheckedChange={(v) => form.setValue("descuentoActivo", v)}
    />
  </div>

  {form.watch("descuentoActivo") && (
    <div className="space-y-3">
      <div>
        <Label>Porcentaje (%)</Label>
        <Input
          type="number"
          min={1}
          max={99}
          {...form.register("descuentoPorcentaje")}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Desde (opcional)</Label>
          <Input type="datetime-local" {...form.register("descuentoDesde")} />
        </div>
        <div>
          <Label>Hasta (opcional)</Label>
          <Input type="datetime-local" {...form.register("descuentoHasta")} />
        </div>
      </div>
      {/* Vista previa */}
      {form.watch("descuentoPorcentaje") && (
        <p className="text-sm text-muted-foreground">
          Vista previa:{" "}
          <span className="line-through">{formatCurrency(precioVenta)}</span>
          {" → "}
          <span className="font-semibold text-destructive">
            {formatCurrency(
              precioVenta * (1 - form.watch("descuentoPorcentaje") / 100),
            )}
          </span>
        </p>
      )}
    </div>
  )}
</div>;
```

**Qué se reutiliza:** los date pickers ya existen en el formulario (`fechaVencimiento`). El toggle Switch (`activo`) ya existe también. Solo se replica el patrón.

---

## Etapa 5 — Frontend: catálogo público

### En `product-card.tsx`

Solo visualización — sin lógica de cálculo ni evaluación de fechas:

```tsx
{
  producto.descuentoEfectivo ? (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="line-through text-muted-foreground text-sm">
        {formatCurrency(producto.descuentoEfectivo.precioOriginal)}
      </span>
      <span className="font-bold text-destructive text-lg">
        {formatCurrency(producto.descuentoEfectivo.precioFinal)}
      </span>
      <Badge variant="destructive" className="text-xs">
        -{producto.descuentoEfectivo.porcentaje}%
      </Badge>
    </div>
  ) : (
    <span className="font-bold text-lg">
      {formatCurrency(Number(producto.precioVenta))}
    </span>
  );
}
```

### En `product-modal.tsx`

Con más espacio visual para mostrar el ahorro en pesos:

```tsx
{
  producto.descuentoEfectivo ? (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <span className="line-through text-muted-foreground">
          {formatCurrency(producto.descuentoEfectivo.precioOriginal)}
        </span>
        <Badge variant="destructive">
          -{producto.descuentoEfectivo.porcentaje}%
        </Badge>
      </div>
      <p className="text-2xl font-bold text-destructive">
        {formatCurrency(producto.descuentoEfectivo.precioFinal)}
      </p>
      <p className="text-sm text-green-600">
        Ahorrás{" "}
        {formatCurrency(
          producto.descuentoEfectivo.precioOriginal -
            producto.descuentoEfectivo.precioFinal,
        )}
      </p>
    </div>
  ) : (
    <p className="text-2xl font-bold">
      {formatCurrency(Number(producto.precioVenta))}
    </p>
  );
}
```

### En el carrito (`cart-drawer.tsx`)

Usar `precioFinal` del descuento como precio base para el subtotal:

```typescript
const subtotalProductos = cart.reduce((acc, item) => {
  const precioUnitario =
    item.descuentoEfectivo?.precioFinal ?? Number(item.precioVenta);
  return acc + precioUnitario * item.quantity;
}, 0);
```

---

## Etapa 6 — Datos del catálogo público

### En `src/lib/public-catalog.ts`

El `SELECT` de Prisma ya incluye los campos del producto. Agregar los nuevos campos y calcular `descuentoEfectivo` al mapear:

```typescript
import { calcularDescuentoEfectivo } from "@/lib/descuento-utils";

// Al mapear productos en getPublicCatalogDataRaw():
const ahora = new Date(); // Una sola instancia para toda la request

productos: productosRaw.map((p) => ({
  ...mapearProducto(p),
  descuentoEfectivo: calcularDescuentoEfectivo({
    descuentoActivo: p.descuentoActivo,
    descuentoPorcentaje: p.descuentoPorcentaje ? Number(p.descuentoPorcentaje) : null,
    descuentoDesde: p.descuentoDesde,
    descuentoHasta: p.descuentoHasta,
    precioVenta: Number(p.precioVenta),
  }, ahora),
})),
```

> El `revalidate: 120` ya existente funciona correctamente: la vigencia se evalúa en cada revalidación del servidor, no en el cliente.

---

## Flujo completo

```
Admin configura descuento en producto
  └─ PUT /api/productos/[id]
       └─ Guarda: descuentoPorcentaje, descuentoActivo, descuentoDesde, descuentoHasta

Cliente abre catálogo público
  └─ GET /lista (Next.js ISR, revalidate 120s)
       └─ public-catalog.ts consulta Prisma
            └─ Backend evalúa vigencia por producto con calcularDescuentoEfectivo()
                 └─ Devuelve descuentoEfectivo: { porcentaje, precioOriginal, precioFinal } | null

Frontend consume descuentoEfectivo (sin lógica de negocio)
  ├─ product-card → precio tachado + precio final + badge "%"
  ├─ product-modal → ahorro en pesos + badge
  └─ cart-drawer → usa precioFinal como precio de venta efectivo
```

---

## Resumen por etapa

| Etapa            | Archivos modificados                                                                                                          | Archivos nuevos                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1 — DB           | `prisma/schema.prisma`                                                                                                        | migración SQL generada por Prisma |
| 2 — Utilidad     | —                                                                                                                             | `src/lib/descuento-utils.ts`      |
| 3 — Backend      | `src/app/api/productos/route.ts`, `src/app/api/productos/[id]/route.ts`, `src/lib/validators/producto.ts`, `src/lib/types.ts` | —                                 |
| 4 — Admin UI     | `edit-producto-dialog.tsx`, `create-producto-dialog.tsx`                                                                      | —                                 |
| 5 — Catálogo     | `product-card.tsx`, `product-modal.tsx`, `cart-drawer.tsx`                                                                    | —                                 |
| 6 — Data service | `src/lib/public-catalog.ts`                                                                                                   | —                                 |

**Archivos que no se tocan:** modelos de venta, consignación, categorías, stock, rutas de auth, dashboard KPIs. El descuento de producto es ortogonal a todo eso.
