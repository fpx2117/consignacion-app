# Propuesta: Mejora de Visualizaciones del Catálogo

## Intención

El catálogo público (`/lista`) y sus KPIs en el dashboard presentan inconsistencias visuales y bugs funcionales detectados en la inspección del código. Esta propuesta unifica tres líneas de mejora: (1) corrección de bugs en el pipeline de datos del catálogo, (2) incorporación del filtro de período del dashboard en el KPI de visitas al catálogo, y (3) adición de nuevos KPIs orientados al canal digital para completar la vista operativa.

## Contexto y Bugs Detectados

| #   | Archivo                                                                           | Bug                                                                                                                                                                                                                            | Severidad |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| B1  | `src/lib/kpi-logic.ts:177`                                                        | `(prisma as any).catalogVisit` — acceso `any` que explota en runtime si el modelo no existe en el cliente Prisma generado                                                                                                      | 🔴 Alta   |
| B2  | `src/app/api/dashboard/kpi/route.ts:24-26`                                        | `consignaciones.abiertas = stats.counts` usa el conteo total de consignaciones, no las ABIERTAS                                                                                                                                | 🟠 Media  |
| B3  | `src/app/(system-guard)/(protected)/dashboard/actions/dashboard-actions.ts:71-76` | `consignacionUnits.pendientes` siempre devuelve `0` hardcodeado; el dashboard muestra "0 units en clientes" siempre                                                                                                            | 🟠 Media  |
| B4  | `src/app/lista/components/product-card.tsx:37`                                    | `porcentajeAumentoConsignacion ?? 0` puede ser `null` en la DB → precio se multiplica por `1 + null/100 = 1 + 0 = correcto`, pero si la prop llega como `undefined` en el tipo TypeScript, el `??` no lo protege correctamente | 🟡 Baja   |
| B5  | `src/lib/kpi-logic.ts:53-58`                                                      | La lógica `catalogUsesSucursalScope` es confusa y puede filtrar sin sucursalId cuando `isGlobal=false` y `hasSharedCatalogEnabled=true`                                                                                        | 🟡 Baja   |

## Alcance

### Dentro del alcance

- **Bug B1**: Tipar correctamente `catalogVisit` en `kpi-logic.ts` usando el cliente Prisma real; validar existencia del modelo antes de contar.
- **Bug B2**: Corregir `kpi/route.ts` para que `consignaciones.abiertas` refleje las consignaciones con estado `ABIERTA`, no el total.
- **Bug B3**: Calcular `consignacionUnits.pendientes` real en `dashboard-actions.ts` (query a `ConsignacionDetalle` sumando units pendientes).
- **Bug B4**: Sanitizar `porcentajeAumentoConsignacion` con `Number(config.porcentajeAumentoConsignacion) || 0` en `product-card.tsx`.
- **Filtro de período en KPI catálogo**: El KPI "Visitas Catálogo" ya filtra por período en `kpi-logic.ts`, pero el label del KPI no indica el período activo → agregar subtítulo dinámico con el período seleccionado.
- **Nuevos KPIs del catálogo**: Agregar en la sección "Estado Operativo" del dashboard:
  - `catalogo-tasa-engagement`: Productos vistos (modal abierto) vs productos listados → ratio de engagement del catálogo.
  - `catalogo-productos-visibles`: Cantidad de productos activos visibles en el catálogo según el período/sucursal.
  - `catalogo-carrito-abandonado`: Pedidos de checkout iniciados pero no completados (si aplica según configuración de checkout).

### Fuera del alcance

- Reescritura del modelo de visitas (`CatalogVisit`) — ya fue propuesto en `kpi-visitas-catalogo-dashboard`.
- Integración con herramientas externas de analítica (GA4, Hotjar, etc.).
- Rediseño visual del catálogo público.
- Cambios en el modelo Prisma (solo se extiende lo existente).

## Enfoque

### Corrección de Bugs

Aplicar las correcciones en los archivos afectados sin cambiar interfaces públicas. Las fixes de B1, B2 y B3 son localizadas y no requieren migraciones.

### Nuevos KPIs del Catálogo

Extender `getDashboardKpis` en `kpi-logic.ts` para incluir:

- Conteo de productos visibles en el catálogo para el período (usando la tabla `Producto`/`StockSucursal` ya disponible).
- Cálculo de visitas con label de período dinámico en el KPI card del dashboard.

El KPI de "Productos Visibles en Catálogo" es un dato estático (no depende del período) y se puede agregar con una query ya existente. Los otros dos KPIs (engagement y carrito abandonado) requieren datos que no se registran actualmente → se implementa el **contador de vistas de modal** como un evento client-side registrado en el catálogo, y se agrega al endpoint de visitas existente.

### Filtro de Período en KPI de Visitas

El `dashboard-header.tsx` ya expone el período al dashboard. El KPI de visitas ya llega filtrado por período desde el backend. La mejora consiste en mostrar el período seleccionado en el subtítulo del KPI card para que el usuario sepa que el número cambia con el filtro.

## Áreas Afectadas

| Área                                                                        | Impacto    | Descripción                                                                          |
| --------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------ |
| `src/lib/kpi-logic.ts`                                                      | Modificado | Fix B1 (tipado CatalogVisit), nuevo KPI `productosVisibles`                          |
| `src/app/api/dashboard/kpi/route.ts`                                        | Modificado | Fix B2 (abiertas real)                                                               |
| `src/app/(system-guard)/(protected)/dashboard/actions/dashboard-actions.ts` | Modificado | Fix B3 (pendientes real), nuevo campo `catalogo.productosVisibles`                   |
| `src/app/(system-guard)/(protected)/dashboard/page.tsx`                     | Modificado | Nuevos KPIs: `catalogo-productos-visibles`, subtítulo dinámico de período en visitas |
| `src/app/lista/components/product-card.tsx`                                 | Modificado | Fix B4 (sanitizar `porcentajeAumentoConsignacion`)                                   |
| `src/lib/types.ts`                                                          | Modificado | Extender `DashboardKpis.catalogo` con `productosVisibles`                            |

## Riesgos

| Riesgo                                                                       | Probabilidad | Mitigación                                                                   |
| ---------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------- |
| `catalogVisit` no existe en el schema Prisma actual                          | Media        | Verificar schema antes; si no existe, envolver en try/catch con fallback a 0 |
| La query de `pendientes` reales puede ser lenta en datasets grandes          | Baja         | Usar `aggregate` en lugar de `findMany`; ya está indexado por `sucursalId`   |
| El KPI de `productosVisibles` puede variar si el catálogo está deshabilitado | Baja         | Devolver `null` si `mostrarListaPrecios = false` y ocultar el KPI            |

## Plan de Rollback

1. Revertir los archivos modificados con `git revert`.
2. Los bugs B2 y B3 son correcciones → el rollback volvería al comportamiento incorrecto previo.
3. No hay migraciones de DB en este change.

## Dependencias

- El modelo `CatalogVisit` debe existir en el schema Prisma (introducido en `kpi-visitas-catalogo-dashboard`). Si no existe, B1 se resuelve con un guard defensivo.
- `DashboardPeriod` type ya existe en `src/lib/types.ts`.

## Criterios de Éxito

- [ ] El KPI "Consignaciones Abiertas" muestra el conteo correcto de consignaciones con estado `ABIERTA`.
- [ ] El KPI "Pendientes" muestra las units pendientes reales, no siempre 0.
- [ ] El KPI "Visitas Catálogo" incluye en su subtítulo el período activo del dashboard (ej: "Esta semana · 12 visitantes únicos").
- [ ] El nuevo KPI "Productos en Catálogo" es visible en la sección Estado Operativo y puede ocultarse/reordenarse.
- [ ] La app no arroja errores de runtime relacionados con `(prisma as any).catalogVisit`.
- [ ] `tsc --noEmit` pasa sin errores nuevos.
