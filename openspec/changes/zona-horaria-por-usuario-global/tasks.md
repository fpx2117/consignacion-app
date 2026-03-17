# Tareas: Zona horaria por usuario global

## Fase 1: Persistencia y contratos base

- [x] 1.1 Modificar `prisma/schema.prisma` para agregar `Usuario.zonaHoraria String?` y mantener `Configuracion.zonaHoraria`/`timezoneMigrationDone` como fallback de sucursal.
- [x] 1.2 Crear la migracion `prisma/migrations/*_usuario_zona_horaria_global/migration.sql` con `ALTER TABLE "Usuario" ADD COLUMN "zonaHoraria" TEXT NULL`, sin backfill masivo.
- [x] 1.3 Regenerar Prisma y alinear tipos base en `src/lib/types.ts` para exponer `zonaHoraria`, `zonaHorariaSucursal`, `zonaHorariaResuelta` y `timezoneSource` en contratos de usuario/configuracion.
- [x] 1.4 Extender `src/lib/apiService.ts` con tipos y metodos para `/api/auth/me` y el nuevo endpoint `src/app/api/settings/profile/timezone/route.ts` (`getProfileTimezone()` / `updateProfileTimezone()`).

## Fase 2: Resolver central y utilidades compartidas

- [x] 2.1 Reconvertir `src/lib/get-configured-tz.ts` en el resolver central para `resolveTimezone()` y `resolveTimezoneForAuth()`, con precedencia `usuario > sucursal > fallback tecnico`, validacion IANA, soporte `activeSucursalId = 0` y `source` (`user|branch|fallback`).
- [x] 2.2 Mantener en `src/lib/get-configured-tz.ts` un wrapper transicional `getConfiguredTz(sucursalId)` para compatibilidad mientras se migran callers existentes.
- [x] 2.3 Ajustar `src/lib/utils-date.ts` para que las funciones de rango/calculo dependan de `tz` explicita o del resolver central, sin defaults distribuidos fuera de `src/lib/get-configured-tz.ts`.
- [x] 2.4 Ajustar `src/lib/utils-format.ts` y `src/lib/reports/template-helpers.ts` para formatear siempre con timezone resuelta/importada y eliminar literals inline de `America/Argentina/Buenos_Aires`.
- [x] 2.5 Actualizar `src/lib/pedidos-esperados.ts` y `src/lib/kpi-logic.ts` para consumir el resolver unico y quitar atajos `isGlobal ? 1 : sucursalId` o formateos con timezone fija.
- [x] 2.6 Agregar observabilidad en `src/lib/get-configured-tz.ts` para registrar cuando `timezoneSource === "fallback"` y facilitar el seguimiento del fallback tecnico temporal.

## Fase 3: Endpoints de sesion, perfil y settings

- [x] 3.1 Modificar `src/app/api/auth/me/route.ts` para devolver `zonaHoraria`, `zonaHorariaSucursal`, `zonaHorariaResuelta` y `timezoneSource` desde el contexto autenticado.
- [x] 3.2 Crear `src/app/api/settings/profile/timezone/route.ts` con `GET`/`PUT` para leer y guardar `Usuario.zonaHoraria`, aceptando `null` para volver a heredar la timezone de sucursal.
- [x] 3.3 Validar IANA en `src/app/api/settings/profile/timezone/route.ts` reutilizando la misma regla del resolver central y responder `400` ante timezones invalidas.
- [x] 3.4 Modificar `src/app/api/settings/general/route.ts` para dejar explicito que `Configuracion.zonaHoraria` es fallback de sucursal y que el endpoint no pisa `Usuario.zonaHoraria` ni cambia la semantica global del usuario.
- [x] 3.5 Revisar `src/app/api/settings/users/route.ts` y `src/lib/auth/require-auth.ts` para asegurar que los payloads/autorizacion no rompan al incorporar la nueva preferencia por usuario en el contexto autenticado.

## Fase 4: UI de settings y consumo transversal de sesion

- [x] 4.1 Modificar `src/hooks/useTimezone.ts` para leer `/api/auth/me` como fuente principal, exponer `tz`, `source`, `formatDate`, `formatDateTime` y `formatDateOnly`, y dejar de depender de `/api/settings/general`.
- [x] 4.2 Actualizar `src/app/(system-guard)/(protected)/settings/general/page.tsx` para separar claramente `Mi zona horaria` (usuario) de `Zona horaria de sucursal` (fallback admin), incluyendo herencia a `null` y estado de origen.
- [x] 4.3 Ajustar `src/components/timezone-selector.tsx` para soportar edicion de timezone personal sin asumir siempre `America/Argentina/Buenos_Aires` como valor inicial efectivo.
- [ ] 4.4 Revisar `src/app/(system-guard)/(protected)/layout.tsx` y consumidores compartidos de sesion para que la timezone resuelta este disponible de forma consistente en toda la UI protegida.

## Fase 5: Propagacion obligatoria a modulos criticos backend

- [x] 5.1 Modificar `src/app/api/ventas/route.ts` y `src/app/api/ventas/[id]/route.ts` para crear/anular ventas con `resolveTimezoneForAuth(auth)` y dejar de depender de `nowAR()`/`getConfiguredTz()` con defaults implicitos.
- [x] 5.2 Modificar `src/app/api/settings/pos/cajas/turno/route.ts` y `src/app/api/settings/pos/cajas/cerrar/route.ts` para validar horario, extensiones y cierres con la timezone resuelta del usuario autenticado.
- [x] 5.3 Modificar `src/app/api/gastos/route.ts` y `src/app/api/gastos/[id]/route.ts` para crear/editar gastos y recurrencias con la timezone efectiva del usuario.
- [x] 5.4 Modificar `src/app/api/historial/route.ts` y `src/app/api/historial/anios/route.ts` para calcular rangos mensuales/anuales con la timezone resuelta y sin `Date#getFullYear()` o defaults locales fuera del helper comun.
- [x] 5.5 Ajustar `src/lib/kpi-logic.ts` para que dashboard/KPI/top productos resuelvan timezone efectiva tambien en vista global, sin hardcodear sucursal principal `id = 1`.
- [x] 5.6 Revisar `src/lib/pedidos-esperados.ts` para que vencimientos, alertas y fechas operativas usen la timezone efectiva o heredada segun el contexto.

## Fase 6: Propagacion a reportes, comprobantes y vistas operativas

- [x] 6.1 Modificar `src/app/ver/ticket/[id]/route.ts`, `src/app/ver/gasto/[id]/route.ts` y `src/app/ver/remito/[id]/route.ts` para resolver timezone efectiva por recurso/usuario y pasarla explicitamente a los templates; en remitos de consignacion, cuando el modelo no persiste un usuario dueño durable, resolver explicitamente por `sucursal > fallback` sin heuristicas indirectas.
- [x] 6.2 Modificar `src/app/ver/inventario/[id]/pdf/route.ts`, `src/app/ver/dashboard/[period]/pdf/route.ts`, `src/app/ver/pos/[period]/pdf/route.ts` y `src/app/ver/consig/[period]/pdf/route.ts` para quitar dependencias a `sucursalId = 1` o a timezone solo de sucursal.
- [x] 6.3 Ajustar `src/lib/reports/base/venta-report-template.ts`, `src/lib/reports/base/gasto-report-template.ts`, `src/lib/reports/base/remito-template.ts` y `src/lib/reports/base/inventory-report-template.ts` para exigir/propagar `zonaHoraria` sin fallback hardcodeado inline.
- [x] 6.4 Revisar `src/app/(system-guard)/(protected)/dashboard/page.tsx`, `src/app/(system-guard)/(protected)/gastos/page.tsx` y `src/app/(system-guard)/(protected)/gastos/components/gastos-list.tsx` para que filtros, KPI y fechas visibles consuman `useTimezone()`.
- [x] 6.5 Revisar `src/app/(system-guard)/(protected)/ventas/[id]/page.tsx`, `src/app/(system-guard)/(protected)/consignaciones/[id]/page.tsx`, `src/app/(system-guard)/(protected)/clientes/details/history-tabs.tsx` y `src/app/(system-guard)/(protected)/caja/historial/page.tsx` para reemplazar formatters locales o timezone del navegador por el helper comun.

## Fase 7: Limpieza de hardcodes y consistencia final

- [x] 7.1 Inventariar y eliminar hardcodes de `America/Argentina/Buenos_Aires` en `src/lib/utils-format.ts`, `src/lib/reports/template-helpers.ts`, `src/lib/pedidos-esperados.ts`, `src/hooks/useTimezone.ts`, `src/app/api/settings/general/route.ts` y templates/reportes que hoy lo sigan usando fuera del resolver central.
- [x] 7.2 Revisar usos de `Intl.DateTimeFormat().resolvedOptions().timeZone`, `toLocaleString()` y helpers locales en `src/components/timezone-selector.tsx` y pantallas operativas para asegurar que el navegador solo se use como sugerencia y nunca como fuente de verdad de negocio.
- [x] 7.3 Confirmar que el fallback tecnico queda encapsulado solo en `src/lib/get-configured-tz.ts` y documentado en OpenSpec como compatibilidad temporal, sin nuevos literals inline en rutas, utilidades o UI.

## Fase 8: Pruebas y verificacion

- [x] 8.1 Escribir pruebas unitarias para `src/lib/get-configured-tz.ts` cubriendo `user`, `branch`, `fallback`, timezone invalida y vista global (`activeSucursalId = 0`).
- [x] 8.2 Escribir pruebas unitarias para `src/app/api/settings/profile/timezone/route.ts` y `src/app/api/auth/me/route.ts` validando IANA, `null = heredar`, payload de `timezoneSource` y consistencia con la DB.
- [x] 8.3 Escribir pruebas unitarias para `src/lib/utils-date.ts`, `src/lib/utils-format.ts` y `src/hooks/useTimezone.ts` con casos de cambio de dia/mes en `America/Bogota`, `America/Santiago` y `Europe/Madrid`.
- [x] 8.4 Escribir pruebas de integracion para `src/app/api/ventas/route.ts`, `src/app/api/settings/pos/cajas/turno/route.ts`, `src/app/api/gastos/route.ts` y `src/app/api/historial/anios/route.ts` verificando que todos usen la timezone resuelta del usuario.
- [ ] 8.5 Ejecutar smoke test manual end-to-end: cambiar `Mi zona horaria` a `America/Bogota` en `src/app/(system-guard)/(protected)/settings/general/page.tsx` y verificar consistencia en dashboard, gastos, ticket, caja, historial, KPI y reportes PDF.
- [x] 8.6 Verificar build/regresion con los comandos del repo (`npx prisma generate`, `npm run lint`, `npx tsc --noEmit`, `npm run build`) y dejar evidencia de los modulos cubiertos antes de cerrar el change.
