# Propuesta: Fix Discrepancias Dashboard UI vs PDF

## Intención

Los KPIs mostrados en el Dashboard UI y los generados en el reporte PDF del dashboard presentan discrepancias significativas que confunden al usuario. La causa raíz principal es que el PDF convierte el período "all" (histórico) a "month" al llamar a `getDashboardKpis`, generando datos financieros completamente diferentes. Además existen diferencias menores en nomenclatura, subtítulos y la doble fuente de datos para gastos.

## Alcance

### Dentro del Alcance
- Fix del bug crítico: período "all" pasa a `getDashboardKpis` como "month" en el PDF
- Unificación de la fuente de datos de gastos en el PDF (evitar dual Prisma directo + cache)
- Homologación de títulos y subtítulos entre Dashboard UI y PDF
- Añadir KPIs faltantes al PDF: "En Catálogo", "Saldo Global"
- Sincronizar los KPIs del PDF con los mismos campos que usa el Dashboard UI

### Fuera del Alcance
- Rediseño visual del template PDF
- Cambios en la lógica de cálculo de KPIs en `kpi-logic.ts`
- Modificaciones al Dashboard UI
- Reportes PDF de otros módulos (POS, Consignaciones, Inventario)

## Enfoque

Corregir el route.ts del PDF (`src/app/ver/dashboard/[period]/pdf/route.ts`) para:

1. **Eliminar la conversión `all → month`**: pasar el período real a `getDashboardKpis`
2. **Usar `fetchDashboardKpis`** del dashboard-actions como fuente centralizada (ya transforma los datos al formato del Dashboard UI)
3. **Reutilizar los datos de gastos desde `kpis.gastos`** en lugar de consultar Prisma directamente para el total
4. **Añadir KPIs faltantes** al `DashboardReportData` y al template HTML
5. **Homologar títulos** del PDF con los del Dashboard UI

## Áreas Afectadas

| Área | Impacto | Descripción |
|------|---------|-------------|
| `src/app/ver/dashboard/[period]/pdf/route.ts` | Modificado | Fix período "all", unificar fuente de datos |
| `src/lib/reports/base/dashboard-report-template.ts` | Modificado | Añadir KPIs faltantes, homologar títulos |
| `src/lib/kpi-logic.ts` | No modificado | Fuente de verdad, no se toca |
| `src/app/(system-guard)/(protected)/dashboard/page.tsx` | No modificado | Referencia de comportamiento esperado |

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| PDF con período "all" ahora tarda más (consulta datos históricos) | Media | `getDashboardKpis` ya tiene `unstable_cache` de 60s |
| Tabla de gastos del PDF pierde detalle si se simplifica | Baja | Mantener la consulta de detalle de gastos separada |
| Breaking change en el template si cambian los campos de `DashboardReportData` | Baja | Añadir campos nuevos sin eliminar existentes |

## Plan de Reversión (Rollback)

- Git revert del commit que modifica `route.ts` y `dashboard-report-template.ts`
- Los cambios son completamente backward-compatible: si se revierte, el PDF vuelve al comportamiento anterior (con el bug)
- No hay migraciones de base de datos involucradas

## Dependencias

- Ninguna dependencia externa. Los cambios son puramente en código del lado del servidor.

## Criterios de Éxito

- [ ] Al seleccionar período "Histórico" en el Dashboard, los KPIs coinciden exactamente con los del PDF generado
- [ ] Al seleccionar período "Este mes", los KPIs coinciden exactamente
- [ ] Al seleccionar período "Esta semana", los KPIs coinciden exactamente
- [ ] Al seleccionar período "Hoy", los KPIs coinciden exactamente
- [ ] El PDF incluye "En Catálogo" y "Saldo Global"
- [ ] Los títulos del PDF coinciden con los del Dashboard UI
- [ ] El total de gastos en el PDF coincide con la suma de la tabla de detalle
