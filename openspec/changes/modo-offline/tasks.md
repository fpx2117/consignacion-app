# Tasks: Modo Offline POS

## Fase 1 - Base

- [ ] 1.1 Crear contrato base offline en `src/lib/offline/contracts.ts` con tipos `OfflineOutboxItem`, `SyncPushRequest`, `SyncPushResponse` y codigos de conflicto.
- [ ] 1.2 Crear almacenamiento local en `src/lib/offline/indexeddb.ts` con stores para `cache_productos`, `cache_clientes`, `outbox` y `sync_meta`.
- [ ] 1.3 Crear utilidades de cola en `src/lib/offline/outbox.ts` (alta, listar pendientes, marcar `SYNCING`, `ACKED`, `CONFLICT`, `REJECTED`).
- [ ] 1.4 Crear detector de conectividad en `src/lib/offline/connectivity.ts` con eventos de reconexion para disparar sync.
- [ ] 1.5 Crear motor de sync inicial en `src/lib/offline/sync-engine.ts` con lote, retry y backoff exponencial.
- [ ] 1.6 Extender `src/store/useSucursalStore.ts` para exponer estado `isOnline`, `pendingCount`, `lastSyncAt` y errores de sincronizacion.
- [ ] 1.7 Preparar assets PWA creando `public/manifest.webmanifest` y `public/sw.js` con app shell minima.
- [ ] 1.8 Definir feature flag `POS_OFFLINE_MVP` en configuracion de entorno usada por `server.ts` y runtime de app.

## Fase 2 - Implementacion

- [ ] 2.1 Integrar wrapper offline en `src/lib/apiService.ts` para lecturas `getProductos` y `getClientes` con fallback a cache local.
- [ ] 2.2 Integrar wrapper offline en `src/lib/apiService.ts` para `createVentaDirecta` y `createPago` enviando a outbox cuando no hay red.
- [ ] 2.3 Adaptar `src/app/(system-guard)/(protected)/ventas/nueva/page.tsx` para crear venta pendiente offline y reflejar estado en UI.
- [ ] 2.4 Ajustar `src/components/top-bar.tsx` para mostrar indicador online/offline y cantidad de pendientes.
- [ ] 2.5 Inicializar servicios offline en `src/app/(system-guard)/(protected)/layout.tsx` para boot de connectivity + sync-engine.
- [ ] 2.6 Crear endpoint `src/app/api/sync/push/route.ts` para procesar lote de mutaciones con resultado por `clientMutationId`.
- [ ] 2.7 Crear endpoint `src/app/api/sync/pull/route.ts` para entregar deltas por checkpoint (`productos`, `clientes`, `ventas`, `pagos`).
- [ ] 2.8 Adaptar `src/app/api/ventas/route.ts` para aceptar `clientMutationId` y deduplicar inserciones offline.
- [ ] 2.9 Adaptar `src/app/api/pagos/route.ts` para registrar pagos sincronizados con validaciones de integridad.
- [ ] 2.10 Adaptar `src/app/api/clientes/route.ts` para soportar pull incremental por `updatedAt` o checkpoint.
- [ ] 2.11 Ajustar `src/lib/requireAuth.ts` para permitir operaciones sync autenticadas con misma sesion en reconexion.
- [ ] 2.12 Actualizar `prisma/schema.prisma` con estructura de idempotencia/sync requerida por push/pull.
- [ ] 2.13 Generar migracion en `prisma/migrations/*` sin cambios destructivos para ambientes con datos.

## Fase 3 - Integracion

- [ ] 3.1 Conectar `src/lib/offline/sync-engine.ts` con `src/app/api/sync/push/route.ts` y `src/app/api/sync/pull/route.ts` usando contratos versionados.
- [ ] 3.2 Integrar `src/lib/offline/sync-engine.ts` con `src/store/useSucursalStore.ts` para actualizar `pendingCount` y `lastSyncAt` en tiempo real.
- [ ] 3.3 Implementar invalidacion/refresco de cache local en `src/lib/apiService.ts` despues de un `pull` exitoso.
- [ ] 3.4 Agregar trazabilidad minima en `src/app/api/sync/push/route.ts` y `src/app/api/ventas/route.ts` (logs con `deviceId`, `clientMutationId`, `status`).
- [ ] 3.5 Verificar compatibilidad del SW con server custom en `server.ts` (headers y entrega correcta de `manifest`/`sw.js`).
- [ ] 3.6 Asegurar que `src/app/(system-guard)/(protected)/ventas/nueva/page.tsx` maneje conflictos de sync sin perder el carrito local.

## Fase 4 - Pruebas

- [ ] 4.1 Crear tests unitarios para `src/lib/offline/outbox.ts` cubriendo transiciones de estado y reintentos.
- [ ] 4.2 Crear tests unitarios para `src/lib/offline/sync-engine.ts` cubriendo backoff, corte de lote y recuperacion tras error.
- [ ] 4.3 Crear tests de integracion para `src/app/api/sync/push/route.ts` verificando idempotencia por `clientMutationId`.
- [ ] 4.4 Crear tests de integracion para `src/app/api/sync/push/route.ts` en conflicto de stock (`CONFLICT` sin doble descuento).
- [ ] 4.5 Crear tests de integracion para `src/app/api/sync/pull/route.ts` validando deltas por checkpoint y orden temporal.
- [ ] 4.6 Crear prueba de UI sobre `src/app/(system-guard)/(protected)/ventas/nueva/page.tsx` para flujo offline -> pendiente -> sync exitoso.
- [ ] 4.7 Ejecutar smoke de regresion online en `src/app/api/ventas/route.ts` y `src/app/api/pagos/route.ts` con `POS_OFFLINE_MVP=false`.
- [ ] 4.8 Verificar instalacion PWA y carga de app shell offline usando `public/manifest.webmanifest` y `public/sw.js`.

## Fase 5 - Documentacion/Cierre

- [ ] 5.1 Actualizar `openspec/changes/modo-offline/design.md` con decisiones finales luego de validacion tecnica.
- [ ] 5.2 Documentar runbook operativo de sync (reintentos, conflictos, bloqueo de cierre de caja) en `docs/GUIA_TECNICA_PROYECTO.md`.
- [ ] 5.3 Registrar notas de despliegue y rollback en `docs/CHANGELOG.md` con pasos por flag `POS_OFFLINE_MVP`.
- [ ] 5.4 Verificar que `openspec/changes/modo-offline/proposal.md`, `openspec/changes/modo-offline/design.md` y `openspec/changes/modo-offline/tasks.md` queden alineados.
- [ ] 5.5 Cerrar el cambio con evidencia de pruebas y riesgos remanentes en `openspec/changes/modo-offline/tasks.md`.
