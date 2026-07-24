# Tasks: Mejora de Visualizaciones del Catálogo

**Change**: `mejora-visualizaciones-catalogo`
**Archivos afectados**: 6
**Estimación**: 2-3 horas
**Riesgo**: Bajo (sin migraciones, sin cambios de schema)

---

## Fase 1 — Tipos y Contratos

### T1.1 — Extender `DashboardKpis.catalogo` en `types.ts`

- **Archivo**: `src/lib/types.ts`
- **Acción**: Agregar campo `productosVisibles: number` al tipo `DashboardKpis.catalogo`
- **Criterio**: `tsc --noEmit` no debe reportar errores en esta fase

```typescript
// Línea ~683-686 en types.ts
catalogo: {
  visitas: number;
  visitantesUnicos: number;
  productosVisibles: number; // ← agregar
}
```

- [x] Modificar `src/lib/types.ts`
- [x] Verificar `tsc --noEmit` (se esperan errores temporales en kpi-logic y actions porque el campo todavía no se devuelve)

---

## Fase 2 — Core: Correcciones en `kpi-logic.ts`

> **IMPORTANTE**: Todos los cambios de esta fase están en UN solo archivo. Respetar el orden para mantener coherencia en los índices del `Promise.all`.

### T2.1 — Fix B1: Guard defensivo para `catalogVisit`

- **Archivo**: `src/lib/kpi-logic.ts`
- **Líneas**: ~177-183
- **Acción**: Agregar check de existencia del modelo antes de llamarlo

```typescript
// Agregar ANTES del Promise.all:
const hasCatalogVisitModel = "catalogVisit" in prisma;

// Reemplazar ítems 14 y 15 del Promise.all:
hasCatalogVisitModel
  ? (prisma as any).catalogVisit.count({ where: catalogVisitWhere })
  : Promise.resolve(0),
hasCatalogVisitModel
  ? (prisma as any).catalogVisit.groupBy({ by: ["visitorHash"], where: catalogVisitWhere })
  : Promise.resolve([]),
```

- [x] Implementar guard `hasCatalogVisitModel`
- [x] Reemplazar las dos llamadas `(prisma as any)` con las versiones guardadas

### T2.2 — Fix B2: Separar conteo de consignaciones abiertas vs totales

- **Archivo**: `src/lib/kpi-logic.ts`
- **Línea**: ~78 (ítem 1 del Promise.all)
- **Acción**: Separar en dos queries y renombrar variables de desestructuración

```typescript
// Reemplazar ítem 1 del Promise.all:
// ANTES: prisma.consignacion.count({ where: sucursalWhere })
// DESPUÉS: dos queries

prisma.consignacion.count({ where: { ...sucursalWhere, estado: "ABIERTA" } }),
prisma.consignacion.count({ where: { ...sucursalWhere, fecha: dateWhere } }),
```

- [x] Reemplazar el ítem 1 del `Promise.all` con las dos queries
- [x] Actualizar la desestructuración del `Promise.all`: `counts` → `countAbiertas, countEnPeriodo`
- [x] Actualizar el objeto de retorno para usar ambos campos:
  ```typescript
  // ANTES
  counts,
  // DESPUÉS
  countAbiertas,
  countEnPeriodo,
  ```

### T2.3 — Fix B3: Calcular units pendientes reales

- **Archivo**: `src/lib/kpi-logic.ts`
- **Acción**: Agregar query de aggregate de units pendientes al `Promise.all`

```typescript
// Agregar ítem nuevo al Promise.all (al final, antes del cierre del array):
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

- [x] Agregar query de `consignacionDetalle.aggregate` al `Promise.all`
- [x] Actualizar desestructuración: agregar `unitsPendientesAgg`
- [x] Calcular `unitsPendientesTotal` en la sección de cálculos:
  ```typescript
  const unitsPendientesTotal = Math.max(
    0,
    (unitsPendientesAgg._sum.unitsEntregadas ?? 0) -
      (unitsPendientesAgg._sum.unitsVendidasAcum ?? 0) -
      (unitsPendientesAgg._sum.unitsDevueltasAcum ?? 0),
  );
  ```
- [x] Agregar al objeto de retorno:
  ```typescript
  consignacionUnits: {
    pendientes: unitsPendientesTotal,
  },
  ```

### T2.4 — Nuevo KPI: `productosVisibles` en catálogo

- **Archivo**: `src/lib/kpi-logic.ts`
- **Acción**: Agregar query de conteo de productos activos con stock

```typescript
// Agregar ítem nuevo al Promise.all:
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

- [x] Agregar query de conteo de productos al `Promise.all`
- [x] Actualizar desestructuración: agregar `productosVisiblesCount`
- [x] Agregar al objeto de retorno dentro de `catalogo`:
  ```typescript
  catalogo: {
    visitas: catalogVisitsCount,
    visitantesUnicos: catalogVisitorsUnique.length,
    productosVisibles: productosVisiblesCount,   // ← nuevo
  },
  ```

### T2.5 — Verificación de `kpi-logic.ts`

- [x] Verificar `tsc --noEmit` (solo este archivo)
- [x] Verificar que el orden de desestructuración del `Promise.all` sea correcto (contar índices)

---

## Fase 3 — API Route y Server Actions

### T3.1 — Fix B2 en `kpi/route.ts`: usar campos correctos

- **Archivo**: `src/app/api/dashboard/kpi/route.ts`
- **Acción**: Actualizar el mapeo de `consignaciones` para usar `countAbiertas` y `countEnPeriodo`

```typescript
// ANTES
consignaciones: {
  total: stats.counts,
  abiertas: stats.counts,
  cerradas: 0,
  creadasEnPeriodo: stats.counts,
},

// DESPUÉS
consignaciones: {
  total: stats.countEnPeriodo,
  abiertas: stats.countAbiertas,
  cerradas: 0,
  creadasEnPeriodo: stats.countEnPeriodo,
},
```

- [x] Actualizar `src/app/api/dashboard/kpi/route.ts`

### T3.2 — Fix B2 y B3 en `dashboard-actions.ts`

- **Archivo**: `src/app/(system-guard)/(protected)/dashboard/actions/dashboard-actions.ts`
- **Acción**: Consumir los nuevos campos de `kpi-logic`

```typescript
// Fix B2 — consignaciones:
consignaciones: {
  total: stats.countEnPeriodo,
  abiertas: stats.countAbiertas,    // ← antes: stats.counts
  cerradas: 0,
  creadasEnPeriodo: stats.countEnPeriodo,
},

// Fix B3 — consignacionUnits:
consignacionUnits: {
  entregadas: 0,
  vendidas: 0,
  devueltas: 0,
  pendientes: stats.consignacionUnits?.pendientes ?? 0,  // ← antes: 0 hardcodeado
},

// Nuevo campo catalogo.productosVisibles:
catalogo: {
  visitas: stats.catalogo?.visitas ?? 0,
  visitantesUnicos: stats.catalogo?.visitantesUnicos ?? 0,
  productosVisibles: stats.catalogo?.productosVisibles ?? 0,  // ← nuevo
},
```

- [x] Actualizar mapeo de `consignaciones`
- [x] Actualizar mapeo de `consignacionUnits.pendientes`
- [x] Agregar `catalogo.productosVisibles`

### T3.3 — Verificación de Fase 3

- [x] `tsc --noEmit` sin errores

---

## Fase 4 — Fix en el Catálogo Público

### T4.1 — Fix B4: Sanitizar `porcentajeAumentoConsignacion`

- **Archivo**: `src/app/lista/components/product-card.tsx`
- **Línea**: ~36-38
- **Acción**: Reemplazar `?? 0` con `Number(...) || 0`

```typescript
// ANTES
const displayedPrice = isConsigne
  ? basePrice * (1 + (config.porcentajeAumentoConsignacion ?? 0) / 100)
  : basePrice;

// DESPUÉS
const pct = Number(config.porcentajeAumentoConsignacion) || 0;
const displayedPrice = isConsigne ? basePrice * (1 + pct / 100) : basePrice;
```

- [x] Modificar `src/app/lista/components/product-card.tsx`

---

## Fase 5 — Dashboard UI: Nuevos KPIs y Mejoras Visuales

### T5.1 — Importar ícono `Package` en `page.tsx`

- **Archivo**: `src/app/(system-guard)/(protected)/dashboard/page.tsx`
- **Acción**: Agregar `Package` a los imports de `lucide-react`

- [x] Agregar `Package` al import de lucide-react (línea ~29)

### T5.2 — Agregar label de período al subtítulo del KPI de Visitas

- **Archivo**: `src/app/(system-guard)/(protected)/dashboard/page.tsx`
- **Acción**: Agregar mapa de labels de período y usarlo en el subtítulo

```typescript
// Agregar constante ANTES del componente DashboardPage (o dentro del useMemo de operativeKpis):
const PERIOD_LABEL: Record<DashboardPeriod, string> = {
  today: "hoy",
  week: "esta semana",
  month: "este mes",
  all: "histórico",
};

// Actualizar el KPI catalogo-visitas dentro de operativeKpis:
{
  key: "catalogo-visitas",
  title: "Visitas Catálogo",
  value: formatNumber(kpis?.catalogo?.visitas ?? 0),
  subtitle: `${formatNumber(kpis?.catalogo?.visitantesUnicos ?? 0)} únicos · ${PERIOD_LABEL[period]}`,
  icon: Store,
  loading,
},
```

- [x] Agregar constante `PERIOD_LABEL` en `page.tsx`
- [x] Actualizar subtítulo del KPI `catalogo-visitas`

### T5.3 — Agregar KPI `catalogo-productos-visibles`

- **Archivo**: `src/app/(system-guard)/(protected)/dashboard/page.tsx`
- **Acción**: Agregar nuevo KPI al array `operativeKpis` (después de `catalogo-visitas`)

```typescript
{
  key: "catalogo-productos-visibles",
  title: "En Catálogo",
  value: formatNumber(kpis?.catalogo?.productosVisibles ?? 0),
  subtitle: "Productos activos con stock",
  icon: Package,
  loading,
},
```

- [x] Agregar el KPI al array `operativeKpis` (justo después de `catalogo-visitas`)

### T5.4 — Verificación visual final

- [x] `tsc --noEmit` sin errores en toda la aplicación (solo errores preexistentes en pos-report-template.ts, fuera del scope)
- [ ] Verificar en runtime: KPI "Consignaciones" muestra el número correcto de abiertas
- [ ] Verificar en runtime: KPI "Pendientes" ya no muestra siempre "0 units en clientes"
- [ ] Verificar en runtime: KPI "Visitas Catálogo" muestra el período activo en el subtítulo
- [ ] Verificar en runtime: KPI "En Catálogo" aparece en la sección Estado Operativo
- [ ] Verificar que los KPIs nuevos se pueden ocultar/mostrar desde "Personalizar KPIs"
- [ ] Verificar en `/lista` que el precio en modo consignación no muestra NaN

---

## Resumen de Tareas por Archivo

| Archivo                                                                     | Tasks                        | Estado |
| --------------------------------------------------------------------------- | ---------------------------- | ------ |
| `src/lib/types.ts`                                                          | T1.1                         | ✅     |
| `src/lib/kpi-logic.ts`                                                      | T2.1, T2.2, T2.3, T2.4, T2.5 | ✅     |
| `src/app/api/dashboard/kpi/route.ts`                                        | T3.1                         | ✅     |
| `src/app/(system-guard)/(protected)/dashboard/actions/dashboard-actions.ts` | T3.2                         | ✅     |
| `src/app/lista/components/product-card.tsx`                                 | T4.1                         | ✅     |
| `src/app/(system-guard)/(protected)/dashboard/page.tsx`                     | T5.1, T5.2, T5.3, T5.4       | ✅     |

**Total de tareas atómicas**: 19
**Orden crítico**: Fase 1 → Fase 2 → Fase 3 → Fase 4 y 5 (pueden ir en paralelo)
