# Tareas: Fix Discrepancias Dashboard UI vs PDF

## Fase 1: Fix Crítico — Período "all"

- [x] 1.1 Eliminar la línea `const kpiPeriod = period === "all" ? "month" : period;` en `src/app/ver/dashboard/[period]/pdf/route.ts` (línea 93)
- [x] 1.2 Cambiar la llamada `getDashboardKpis(scopedSucursalId, kpiPeriod, ...)` → `getDashboardKpis(scopedSucursalId, period, ...)` en `src/app/ver/dashboard/[period]/pdf/route.ts` (línea 101)

## Fase 2: Añadir KPIs Faltantes al Tipo y al Route

- [x] 2.1 Añadir campo `catalogoProductosVisibles?: number` al tipo `DashboardReportData` en `src/lib/reports/base/dashboard-report-template.ts`
- [x] 2.2 Añadir campo `saldoGlobal?: number` al tipo `DashboardReportData` en `src/lib/reports/base/dashboard-report-template.ts`
- [x] 2.3 Mapear `catalogoProductosVisibles: kpis.catalogo?.productosVisibles ?? 0` en el objeto `reportData` de `src/app/ver/dashboard/[period]/pdf/route.ts` (zona línea 222)
- [x] 2.4 Mapear `saldoGlobal: kpis.finanzas.saldoClientesTotal ?? 0` en el objeto `reportData` de `src/app/ver/dashboard/[period]/pdf/route.ts`

## Fase 3: Actualizar Template HTML del PDF

- [x] 3.1 Añadir tarjeta "En Catálogo" en la sección "Canal Digital" del template en `src/lib/reports/base/dashboard-report-template.ts` usando `fmtN(data.catalogoProductosVisibles ?? 0) + " prod."`
- [x] 3.2 Añadir sección "Finanzas Adicionales" con tarjeta "Saldo Global" usando `fmt(data.saldoGlobal ?? 0)` y subtítulo "Deuda acumulada en clientes" en `src/lib/reports/base/dashboard-report-template.ts`
- [x] 3.3 Renombrar título "Ingresos en Caja" → "Movimiento Total" en la sección de Rentabilidad del template para homologar con la UI

## Fase 4: Verificación

- [x] 4.1 Verificar que el build compila sin errores TypeScript (`npm run build` o `npx tsc --noEmit`)
- [ ] 4.2 Comparar manualmente los KPIs del Dashboard UI con los del PDF generado para período "month" — deben ser idénticos
- [ ] 4.3 Comparar manualmente los KPIs del Dashboard UI con los del PDF generado para período "all" — deben ser idénticos
- [ ] 4.4 Verificar que "En Catálogo" y "Saldo Global" aparecen en el PDF generado
- [ ] 4.5 Verificar que la tabla de gastos del PDF sigue funcionando correctamente (detalle + total)
