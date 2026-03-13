# Tareas: KPI visitas de catalogo dashboard/PDF

## Fase 1 - Base de datos y contratos

- [ ] 1.1 Agregar modelo `CatalogVisit` en `prisma/schema.prisma` con `sucursalId`, `visitorHash`, `bucketStart`, `visitedAt`, `source` y `@@unique([sucursalId, visitorHash, bucketStart])`.
- [ ] 1.2 Agregar relacion inversa `catalogVisits CatalogVisit[]` en `model Sucursal` en `prisma/schema.prisma`.
- [ ] 1.3 Generar migracion Prisma no destructiva en `prisma/migrations/*_catalog_visits/migration.sql`.
- [ ] 1.4 Regenerar cliente Prisma y verificar tipos (`npx prisma generate`).
- [ ] 1.5 Extender `DashboardKpis` en `src/lib/types.ts` con bloque `catalogo` (`visitas`, `visitantesUnicos`).

## Fase 2 - Tracking de visitas del catalogo

- [ ] 2.1 Crear utilidades de tracking en `src/lib/analytics/catalog-visit.ts` (normalizar headers, calcular bucket, generar hash).
- [ ] 2.2 Modificar `src/app/api/public/lista-precios/route.ts` para registrar visita deduplicada por bucket antes de responder.
- [ ] 2.3 Asegurar que errores de tracking no rompan la respuesta del catalogo (try/catch aislado y logging controlado).
- [ ] 2.4 Agregar indice de consulta por periodo en migracion (sobre `sucursalId` + `visitedAt`) y validar plan de consulta basico.

## Fase 3 - KPI dashboard y API

- [ ] 3.1 Modificar `src/lib/kpi-logic.ts` para sumar visitas y visitantes unicos segun periodo actual.
- [ ] 3.2 Exponer en `src/lib/kpi-logic.ts` solo metricas catalogo-only: `visitas` y `visitantesUnicos`.
- [ ] 3.3 Modificar `src/app/api/dashboard/kpi/route.ts` para devolver bloque `catalogo` en la respuesta JSON.
- [ ] 3.4 Modificar `src/app/(system-guard)/(protected)/dashboard/page.tsx` para agregar tarjeta `Visitas Catalogo` en `Estado Operativo`.
- [ ] 3.5 Definir subtitulo de negocio en la tarjeta (`Canal publico del periodo`) y destacar `visitantesUnicos` como dato secundario.

## Fase 4 - OKR en reporte PDF

- [ ] 4.1 Extender tipo `DashboardReportData` en `src/lib/reports/base/dashboard-report-template.ts` con campos de catalogo.
- [ ] 4.2 Modificar `src/app/ver/dashboard/[period]/pdf/route.ts` para consultar visitas del periodo y poblar los nuevos campos.
- [ ] 4.3 Modificar `src/lib/reports/base/dashboard-report-template.ts` para renderizar subseccion `Canal Digital` debajo de `Rentabilidad`.
- [ ] 4.4 Incluir en PDF al menos: `Visitas de Catalogo` y `Visitantes Unicos`.
- [ ] 4.5 Verificar que el layout PDF no desborde en A4 para periodos con y sin tendencia.

## Fase 5 - Validacion y cierre

- [ ] 5.1 Probar deduplicacion: 2 requests consecutivos de `lista-precios` en misma ventana temporal cuentan 1 visita.
- [ ] 5.2 Probar cambio de ventana: request luego de 30+ minutos incrementa visitas.
- [ ] 5.3 Probar dashboard para `today`, `week`, `month`, `all` y validar coherencia de cifras.
- [ ] 5.4 Generar PDF del dashboard y confirmar ubicacion del OKR en `Canal Digital`.
- [ ] 5.5 Documentar decision final y valores de deduplicacion en `openspec/changes/kpi-visitas-catalogo-dashboard/design.md`.
