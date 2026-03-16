# Diseño Técnico: Mejora de Visualizaciones del Catálogo

## Resumen

Corrección de 4 bugs en el pipeline de datos del dashboard/catálogo + extensión del tipo `DashboardKpis` con el campo `productosVisibles` + mejora de visualización en los KPIs del catálogo con período dinámico en el subtítulo.

No hay migraciones de DB. No hay cambios de schema Prisma. Sin nuevas dependencias.

---

## Arquitectura Actual (Flujo de Datos del Dashboard)

```
page.tsx (Client Component)
  └── useDashboard(period) [hook]
        └── fetchDashboardKpis(period, sucursalId) [Server Action]
              └── getDashboardKpis(sucursalId, period, isAdmin) [kpi-logic — unstable_cache]
                    └── Prisma → PostgreSQL
```

El período seleccionado en el header del dashboard ya viaja hasta las queries de Prisma. El problema no es que el período no se use — es que:
1. Los bugs hacen que los datos calculados sean incorrectos.
2. El KPI de visitas no indica en su subtítulo qué período está mostrando.
3. Faltan KPIs relevantes para el canal digital.

---

## Cambios por Archivo

### 1. `src/lib/types.ts`

**Cambio**: Extender `DashboardKpis.catalogo` para incluir `productosVisibles`.

```typescript
// ANTES
catalogo: {
  visitas: number;
  visitantesUnicos: number;
};

// DESPUÉS
catalogo: {
  visitas: number;
  visitantesUnicos: number;
  productosVisibles: number;  // ← nuevo: productos activos visibles en el catálogo
};
```

---

### 2. `src/lib/kpi-logic.ts`

#### Fix B1: Tipado seguro de `catalogVisit`

**Problema**: `(prisma as any).catalogVisit` — si el modelo no existe en el cliente Prisma generado, esto falla en runtime con `TypeError: prisma.catalogVisit is not a function`.

**Solución**: Verificar existencia del modelo de forma defensiva.

```typescript
// ANTES (líneas 177-183)
(prisma as any).catalogVisit.count({ where: catalogVisitWhere }),
(prisma as any).catalogVisit.groupBy({ by: ["visitorHash"], where: catalogVisitWhere })

// DESPUÉS
// Usar acceso tipado con guard defensivo
const hasCatalogVisitModel = "catalogVisit" in prisma;

// En el Promise.all:
hasCatalogVisitModel
  ? (prisma as any).catalogVisit.count({ where: catalogVisitWhere })
  : Promise.resolve(0),
hasCatalogVisitModel
  ? (prisma as any).catalogVisit.groupBy({ by: ["visitorHash"], where: catalogVisitWhere })
  : Promise.resolve([]),
```

#### Nuevo KPI: `productosVisibles`

Agregar al `Promise.all` existente una query de conteo de productos activos visibles en el catálogo:

```typescript
// Nuevo ítem en el Promise.all (índice 15)
// 15. Productos visibles en catálogo
catalogUsesSucursalScope
  ? prisma.stockSucursal.count({
      where: {
        sucursalId,
        stockDisponibleUnits: { gt: 0 },
        producto: { activo: true },
      },
    })
  : prisma.producto.count({
      where: { activo: true, stockDisponibleUnits: { gt: 0 } },
    }),
```

Agregar al objeto de retorno:

```typescript
catalogo: {
  visitas: catalogVisitsCount,
  visitantesUnicos: catalogVisitorsUnique.length,
  productosVisibles: productosVisiblesCount,  // ← nuevo
},
```

---

### 3. `src/app/api/dashboard/kpi/route.ts`

#### Fix B2: `consignaciones.abiertas` correcto

**Problema**: `abiertas: stats.counts` usa el conteo total de consignaciones, no las ABIERTAS.

**Análisis**: `getDashboardKpis` devuelve `counts` como `prisma.consignacion.count({ where: sucursalWhere })` — NO filtra por `estado: "ABIERTA"`.

**Solución en el route**: La corrección más limpia es en `kpi-logic.ts` — separar en dos conteos:

```typescript
// En kpi-logic.ts, reemplazar la query de counts (ítem 1 del Promise.all):
// ANTES: prisma.consignacion.count({ where: sucursalWhere })
// DESPUÉS: dos queries separadas

prisma.consignacion.count({ where: { ...sucursalWhere, estado: "ABIERTA" } }),
prisma.consignacion.count({ where: { ...sucursalWhere, fecha: dateWhere } }),
```

Retornar ambos valores:
```typescript
// ANTES en el return
counts,

// DESPUÉS
countAbiertas,       // consignaciones ABIERTAS (sin filtro de período)
countEnPeriodo,      // consignaciones creadas en el período
```

Actualizar el route para usar los campos correctos:
```typescript
consignaciones: {
  total: stats.countEnPeriodo,      // creadas en período
  abiertas: stats.countAbiertas,    // ABIERTAS reales
  cerradas: 0,
  creadasEnPeriodo: stats.countEnPeriodo,
},
```

---

### 4. `src/app/(system-guard)/(protected)/dashboard/actions/dashboard-actions.ts`

#### Fix B3: `consignacionUnits.pendientes` real

**Problema**: `pendientes: 0` siempre hardcodeado. El dashboard siempre muestra "0 units en clientes".

**Solución**: Agregar query de units pendientes reales en `getDashboardKpis` de `kpi-logic.ts`:

```typescript
// Agregar al Promise.all (ítem 16):
// 16. Units pendientes (entregadas - vendidas - devueltas) globales por sucursal
prisma.consignacionDetalle.aggregate({
  where: {
    consignacion: { ...sucursalWhere, estado: "ABIERTA" },
  },
  _sum: {
    unitsEntregadas: true,
    unitsVendidasAcum: true,
    unitsDevueltasAcum: true,
  },
}),
```

Calcular en el return:
```typescript
const unitsPendientesTotal = Math.max(0,
  (unitsPendientesAgg._sum.unitsEntregadas ?? 0) -
  (unitsPendientesAgg._sum.unitsVendidasAcum ?? 0) -
  (unitsPendientesAgg._sum.unitsDevueltasAcum ?? 0)
);
```

Retornar en el objeto:
```typescript
// Nuevo campo en el return de kpi-logic:
consignacionUnits: {
  pendientes: unitsPendientesTotal,
},
```

Actualizar `dashboard-actions.ts` para leer el campo real:
```typescript
consignacionUnits: {
  entregadas: 0,
  vendidas: 0,
  devueltas: 0,
  pendientes: stats.consignacionUnits?.pendientes ?? 0,  // ← antes era 0 hardcodeado
},
```

---

### 5. `src/app/lista/components/product-card.tsx`

#### Fix B4: Sanitizar `porcentajeAumentoConsignacion`

**Problema**: Si `config.porcentajeAumentoConsignacion` llega como `null` desde la DB, `?? 0` lo convierte a `0`. Pero si llega como el string `"null"` (JSON encoding edge case) o `NaN`, el cálculo rompe.

**Solución**:
```typescript
// ANTES (línea 37)
const displayedPrice = isConsigne
  ? basePrice * (1 + ((config.porcentajeAumentoConsignacion ?? 0) / 100))
  : basePrice;

// DESPUÉS
const pct = Number(config.porcentajeAumentoConsignacion) || 0;
const displayedPrice = isConsigne ? basePrice * (1 + pct / 100) : basePrice;
```

---

### 6. `src/app/(system-guard)/(protected)/dashboard/page.tsx`

#### Mejora: Subtítulo dinámico del KPI de Visitas

**Cambio**: El KPI `catalogo-visitas` ya recibe el período desde `useDashboard(period)`. Agregar el label del período al subtítulo.

```typescript
// ANTES
{
  key: "catalogo-visitas",
  title: "Visitas Catálogo",
  value: formatNumber(kpis?.catalogo?.visitas ?? 0),
  subtitle: `${formatNumber(kpis?.catalogo?.visitantesUnicos ?? 0)} visitantes únicos`,
  icon: Store,
  loading,
},

// DESPUÉS
const periodLabel: Record<DashboardPeriod, string> = {
  today: "hoy",
  week: "esta semana",
  month: "este mes",
  all: "histórico",
};

{
  key: "catalogo-visitas",
  title: "Visitas Catálogo",
  value: formatNumber(kpis?.catalogo?.visitas ?? 0),
  subtitle: `${formatNumber(kpis?.catalogo?.visitantesUnicos ?? 0)} únicos · ${periodLabel[period]}`,
  icon: Store,
  loading,
},
```

#### Nuevo KPI: `catalogo-productos-visibles`

Agregar en el array `operativeKpis`:

```typescript
{
  key: "catalogo-productos-visibles",
  title: "En Catálogo",
  value: formatNumber(kpis?.catalogo?.productosVisibles ?? 0),
  subtitle: "Productos activos con stock",
  icon: Package,  // importar de lucide-react
  loading,
},
```

---

## Flujo de Datos Actualizado (Post-Fix)

```
Dashboard Header (period selector)
  ↓ period state
page.tsx
  ↓ period prop
useDashboard(period)
  ↓ period argument
fetchDashboardKpis(period, sucursalId) [Server Action]
  ↓ period + sucursalId
getDashboardKpis(sucursalId, period, isAdmin) [kpi-logic]
  ↓ dateWhere calculado del period
  Queries Prisma:
    ├── consignacion.count(estado: ABIERTA)    [✅ Fix B2]
    ├── consignacion.count(fecha: dateWhere)   [✅ Fix B2 — período]
    ├── consignacionDetalle.aggregate(pendientes) [✅ Fix B3]
    ├── catalogVisit.count(visitedAt: dateWhere) [✅ Fix B1 — guard]
    ├── catalogVisit.groupBy(visitorHash)      [✅ Fix B1 — guard]
    └── stockSucursal/producto.count(activo, stock>0) [✅ Nuevo KPI]
  ↓ stats
fetchDashboardKpis return → DashboardKpis
  ↓
page.tsx → operativeKpis array
  ├── catalogo-visitas [subtitle con period label] [✅ Mejora visual]
  └── catalogo-productos-visibles [✅ Nuevo KPI]
```

---

## Decisiones de Diseño

| Decisión | Alternativa Descartada | Razón |
|----------|----------------------|-------|
| Guard defensivo para `catalogVisit` en lugar de tiparlo | Agregar type cast completo | El modelo puede no existir; el guard es más seguro en despliegues donde la migración no corrió |
| Separar counts de consignaciones en kpi-logic (no en route) | Corregir solo en el route | La fuente de verdad debe ser kpi-logic; el route es solo transporte |
| Query de units pendientes via `aggregate` | `findMany` + reduce en JS | `aggregate` es más eficiente y evita traer todos los detalles a memoria |
| Subtítulo dinámico de período en el KPI card | Nueva prop en `KpiCard` | El subtítulo ya es una string libre; no se necesita cambiar la interfaz de `KpiCard` |
| `productosVisibles` separado por scope (sucursal vs global) | Un solo conteo global | Debe ser consistente con el catálogo que ve el cliente público |

---

## Archivos Modificados (Resumen)

| Archivo | Tipo de cambio | Líneas estimadas |
|---------|---------------|-----------------|
| `src/lib/types.ts` | Extensión de tipo | +2 líneas |
| `src/lib/kpi-logic.ts` | Fix B1, Fix B2, Fix B3, nuevo KPI | ~40 líneas |
| `src/app/api/dashboard/kpi/route.ts` | Fix B2 (consume campos nuevos) | ~5 líneas |
| `src/app/(system-guard)/(protected)/dashboard/actions/dashboard-actions.ts` | Fix B2, Fix B3 | ~10 líneas |
| `src/app/(system-guard)/(protected)/dashboard/page.tsx` | Subtítulo dinámico, nuevo KPI | ~15 líneas |
| `src/app/lista/components/product-card.tsx` | Fix B4 | ~3 líneas |

**Total estimado**: ~75 líneas de cambios netos (sin contar comentarios eliminados).
