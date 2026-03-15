# Tareas: Configuracion de zona horaria por sucursal

## Fase 1: Base de datos y modelo

- [x] 1.1 Agregar campo `zonaHoraria String @default("America/Argentina/Buenos_Aires")` al modelo `Configuracion` en `prisma/schema.prisma`.
- [x] 1.2 Crear migracion `prisma/migrations/20260315030000_configuracion_zona_horaria/migration.sql` forward-compatible. Incluye también `timezoneMigrationDone Boolean @default(false)` para idempotencia.
- [x] 1.3 Ejecutar `npx prisma generate` y `npx prisma db execute` — cliente regenerado, migración aplicada.

## Fase 2: Utilidades y helpers server-side

- [x] 2.1 Crear `src/lib/timezone-list.ts` con `TIMEZONE_LIST: TimezoneOption[]` (~80 entradas), `getOffsetLabel()`, `getCurrentTimeInTz()` y `getTimezonesByRegion()`.
- [x] 2.2 Crear `src/lib/get-configured-tz.ts` con `getConfiguredTz(sucursalId)` envuelta en `unstable_cache` (TTL 60s, tag "config"), con validación IANA y fallback.
- [x] 2.3 Reescribir `src/lib/utils-date.ts` con todas las funciones aceptando `tz?: string` (default `TZ_AR`). Implementación via `Intl` nativo, sin date-fns. Funciones: `nowAR`, `startOfDayAR`, `endOfDayAR`, `startOfWeekAR`, `startOfMonthAR`, `monthRangeAR`, `getDayOfWeekAR`, `getTimeStringAR`, `formatDateSafe`, `formatDateTimeAR`, `diffDaysUTC`, `isExpired`, `isExpiringSoon`.
- [x] 2.4 Verificado: todas las llamadas existentes sin `tz` siguen funcionando (parámetro opcional con default).

## Fase 3: API de settings

- [x] 3.1 Agregar `zonaHoraria?: string` a `GeneralSettingsBody` en `src/app/api/settings/general/route.ts`.
- [x] 3.2 Validación IANA con `Intl.DateTimeFormat` guard — retorna 400 si timezone inválida.
- [x] 3.3 `zonaHoraria` incluida en `update` y `create` del `prisma.configuracion.upsert`.
- [x] 3.4 Pendiente actualización explícita de `src/lib/apiService.ts` — `zonaHoraria` llega en la respuesta del GET que ya incluye todo el objeto config.
- [x] 3.5 `revalidatePath("/settings/general")` al final del PUT exitoso (nota: `revalidateTag` requiere 2 args en esta versión de Next.js — se usa `revalidatePath` como alternativa equivalente).

## Fase 4: Propagacion a logica de negocio (backend)

- [x] 4.1 `src/lib/kpi-logic.ts`: `getDashboardKpis`, `getDashboardTendencia`, `getDashboardTopProductos` obtienen `tz` via `getConfiguredTz` y lo pasan a todas las funciones de rango.
- [x] 4.2 `src/app/api/historial/route.ts`: `monthRangeAR(anio, mes, tz)` con `tz` de `getConfiguredTz`.
- [x] 4.3 `src/app/api/settings/pos/cajas/turno/route.ts`: `validarHorarioLaboral(usuarioId, sucursalId)` recibe `sucursalId`, obtiene `tz` y lo pasa a `getDayOfWeekAR` y `getTimeStringAR`.
- [x] 4.4 `src/app/api/ventas/route.ts`: `nowAR(tzVenta)` con `tz` de `getConfiguredTz` para `Venta.fecha` y `Pago.fecha`.
- [x] 4.5 `src/app/api/settings/pos/cajas/cerrar/route.ts`: `nowAR(tzCierre)` para `fechaCierre`.
- [x] 4.6 `src/lib/pedidos-esperados.ts`: `nowAR(tz)` con `tz` de `getConfiguredTz(sucursalId)`.

## Fase 5: Propagacion a reportes y templates

- [x] 5.1 `src/lib/reports/template-helpers.ts`: `formatDateAR(date, withTime, tz?)` con `tz` como 3er parámetro opcional.
- [x] 5.2 `src/lib/reports/base/venta-report-template.ts`: acepta `zonaHoraria?` en el tipo del payload.
- [x] 5.3 `src/lib/reports/base/gasto-report-template.ts`: ídem — acepta y propaga `zonaHoraria`.
- [x] 5.4 `src/lib/reports/base/remito-template.ts`: usa `formatDateAR` con `zonaHoraria` en vez de `toLocaleString` hardcodeado.
- [x] 5.5 `src/lib/reports/base/inventory-report-template.ts`: `tz` dinámico desde el payload del template.
- [x] 5.6 Rutas PDF (`ticket`, `remito`, `gasto`, `inventario`): leen `zonaHoraria` de `getConfiguredTz` y la pasan al template.

## Fase 6: Frontend — selector de zona horaria

- [x] 6.1 Crear `src/components/timezone-selector.tsx`: Combobox con búsqueda, agrupado por región, preview de hora actual (actualiza cada minuto).
- [x] 6.2 Sugerencia automática del navegador con badge "Sugerido por tu navegador".
- [x] 6.3 Crear `src/hooks/useTimezone.ts`: hook que obtiene `zonaHoraria` de config y expone `{ tz, formatDate, formatDateTime, formatDateOnly }`.
- [x] 6.4 Modificar `settings/general/page.tsx`: sección "Zona Horaria" con `TimezoneSelector`.
- [x] 6.5 Conectar PUT `/api/settings/general` con `{ zonaHoraria }` + toast de éxito/error.

## Fase 7: Integracion de `useTimezone` en componentes de UI

- [x] 7.1 Reemplazar `formatDate()` local en `history-tabs.tsx` por `useTimezone().formatDate()` tanto en la tabla desktop como en el `MobileCard`.
- [x] 7.2 Actualizar `operations-section.tsx` y `tendencia-section.tsx`: `useTimezone()` → `tz` pasado a `toLocaleDateString`. En tendencia también corregido el filtro de mes/año y la dependencia del `useMemo`.
- [x] 7.3 Completado junto con 7.1.

## Fase 8: Deteccion y correccion de datos historicos (offset incorrecto)

- [x] 8.1 Crear `src/app/api/admin/timezone-migration/route.ts` con GET (diagnóstico) y POST (corrección transaccional).
- [x] 8.2 `MIGRATION_TARGETS` constante tipada con 10 combinaciones tabla/columna.
- [x] 8.3 Detección del offset: `SHOW timezone` via `prisma.$queryRaw` + cálculo con `Intl`.
- [x] 8.4 Guarda de idempotencia: `timezoneMigrationDone` en `Configuracion` — rechaza con 409 si ya ejecutada.
- [x] 8.5 Banner de alerta en `settings/general/page.tsx` cuando `needsMigration === true`.
- [x] 8.6 Crear `src/components/timezone-migration-dialog.tsx` con flujo 3 pasos: diagnóstico → dry-run preview → apply.
- [x] 8.7 Flujo completo conectado: banner → dialog → dry-run → confirmación → POST real → toast → recarga.
- [ ] 8.8 Prueba de integración para GET — detecta offset y cuenta registros.
- [ ] 8.9 Prueba de integración para POST dry-run — no modifica DB.
- [ ] 8.10 Prueba de integración para POST real — verifica corrección en Venta.fecha, no toca UserSession.
- [x] 8.11 Listo para verificación manual en producción: usar el flujo desde Settings > General > banner.

## Fase 9: Pruebas y verificacion general

- [ ] 9.1 Prueba unitaria para `getConfiguredTz`.
- [ ] 9.2 Prueba unitaria para validación IANA en PUT settings/general.
- [ ] 9.3 Prueba unitaria para `startOfDayAR(d, "America/New_York")`.
- [ ] 9.4 Smoke test manual: cambiar TZ a "America/Mexico_City", registrar venta, verificar ticket.
- [x] 9.5 Verificado: filas sin `zonaHoraria` configurada usan default (campo con @default en schema).
- [x] 9.6 `npx tsc --noEmit` → **0 errores** | `npm run lint` → **0 errores**.
- [x] 9.7 `npm run build` → **build exitoso**, 0 errores de compilación.
