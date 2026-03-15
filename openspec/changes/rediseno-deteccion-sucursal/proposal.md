# Propuesta: Rediseno Deteccion de Sucursal y Paquetes

## Intencion

El sistema actual de deteccion de sucursal activa y verificacion de paquetes/planes presenta **10 bugs identificados** que causan comportamiento intermitente, estados desincronizados y experiencia de usuario impredecible. Los problemas son estructurales — no se pueden resolver con parches individuales porque comparten una raiz comun: **multiples fuentes de verdad sin sincronizacion, caches sin invalidacion y estado local que diverge del servidor**.

### Bugs identificados

1. **Triple fuente de verdad para `activeSucursalId`**: El server resuelve la sucursal activa desde `x-sucursal-id` header > cookie > JWT, sin garantizar que las tres esten sincronizadas. Esto causa que distintas requests del mismo usuario operen contra sucursales diferentes.

2. **Zustand rehydration prematura**: `useSucursalStore` usa `persist` con localStorage, lo que rehidrata el estado del cliente ANTES de que el server valide si las sucursales guardadas siguen siendo permitidas para el usuario. Un empleado reasignado ve sucursales a las que ya no tiene acceso.

3. **Cache stale de `SubscriptionGuard`**: `configCache` es una variable module-level con TTL de 5 minutos que no se invalida al cambiar de plan. Un usuario que hace upgrade/downgrade sigue viendo features del plan anterior hasta que expira el cache.

4. **`subscription_limits` en localStorage sin invalidacion**: Los limites del plan se guardan en localStorage y nunca se limpian al cambiar de plan. Un downgrade no refleja las nuevas restricciones hasta que el usuario limpia manualmente el storage.

5. **JWT con `sucursalId` hardcoded por 7 dias**: El token JWT incluye `sucursalId` en el payload y tiene 7 dias de vida. Si un empleado es reasignado a otra sucursal, el JWT sigue apuntando a la sucursal anterior hasta que expire.

6. **`usarControlDeCaja` sin scope por sucursal**: Esta configuracion se guarda en localStorage sin key por sucursalId, causando que al cambiar de sucursal se aplique la config de la sucursal anterior.

7. **Vista Global (`id=0`) inconsistente con `getConfiguredTz`**: La vista global usa `sucursalId=0` que no existe como registro real en la DB, causando que `getConfiguredTz` falle o retorne el fallback incorrecto.

8. **Suscripcion a nivel USUARIO vs nivel SISTEMA**: Algunas queries filtran la suscripcion por `userId` y otras por sistema global. Esto causa que usuarios del mismo tenant vean estados de suscripcion diferentes.

9. **Sin sincronizacion entre pestanas del browser**: Cambiar de sucursal en una pestana no actualiza las demas. El usuario puede estar operando en sucursal A en una pestana y en sucursal B en otra sin saberlo.

10. **`checkedRef.current` en `SubscriptionGuard`**: El ref booleano puede omitir verificaciones si el componente se monta/desmonta rapidamente (StrictMode, navegacion rapida), permitiendo acceso temporal a features no autorizadas.

Estos bugs son interdependientes y requieren un **rediseno coordinado** del flujo completo, no parches aislados.

## Alcance

### Dentro del alcance

- Establecer **cookie HttpOnly `active_sucursal_id`** como unica fuente de verdad para la sucursal activa, gestionada exclusivamente por el server.
- Refactorizar `useSucursalStore` para **eliminar `persist`** (localStorage) — el store se hidrata exclusivamente desde server props en el layout SSR.
- Crear endpoint `PUT /api/sucursal/active` que setea la cookie HttpOnly y retorna la sucursal validada.
- Refactorizar `require-auth.ts` para resolver `activeSucursalId` unicamente desde la cookie HttpOnly (eliminar fallback a header y JWT).
- Eliminar `sucursalId` del payload JWT — el JWT solo identifica al usuario, la sucursal se resuelve desde la cookie.
- Refactorizar `apiService.ts` para **eliminar** el header `x-sucursal-id` y el param `__sid` — la cookie viaja automaticamente con cada request.
- Implementar **invalidacion reactiva de plan** en `/api/subscriptions/current` con ETag/Last-Modified + client-side polling cada 60 segundos.
- Implementar **`BroadcastChannel`** para sincronizar cambios de sucursal y estado de suscripcion entre pestanas del mismo origen.
- Eliminar `subscription_limits` de localStorage y `configCache` module-level de `SubscriptionGuard` — reemplazar con React Query/SWR con `staleTime` controlado.
- Refactorizar `SubscriptionGuard` para eliminar `checkedRef.current` y usar un patron basado en estado de query (loading/error/success).
- Agregar **scope por sucursal** a configs cacheadas (`usarControlDeCaja` keyed por `sucursalId` en localStorage, o migrar a server config).
- Resolver la Vista Global (`id=0`) con un tratamiento explicito en `getConfiguredTz` y `buildSucursalWhere` que no dependa de un registro DB inexistente.
- Unificar queries de suscripcion para que siempre resuelvan a nivel **sistema/tenant** (no por usuario individual).

### Fuera del alcance

- Migracion a un sistema multi-tenant con DB separadas por tenant.
- Cambio del mecanismo de autenticacion (JWT sigue siendo el metodo auth, solo se remueve `sucursalId` del payload).
- Refactor del UI del selector de sucursal en `top-bar.tsx` (la logica interna cambia, pero el componente visual se mantiene).
- Implementacion de WebSocket/SSE para push en tiempo real de cambios de plan (se usa polling + BroadcastChannel como solucion pragmatica).
- Manejo de roles y permisos granulares por sucursal (fuera de este cambio).
- Refactorizacion de la estructura de carpetas del proyecto.

## Enfoque

El rediseno se basa en tres principios fundamentales:

### 1. Single Source of Truth: Cookie HttpOnly

La sucursal activa se almacena **exclusivamente** en una cookie HttpOnly (`active_sucursal_id`) gestionada por el server. Esto elimina la triple fuente de verdad (header/cookie/JWT) y garantiza que:
- Todas las requests del mismo browser session usan la misma sucursal.
- El client no puede manipular directamente el valor (seguridad).
- La cookie viaja automaticamente en cada request (sin logica manual en `apiService`).

El cambio de sucursal se hace via `PUT /api/sucursal/active`, que valida que el usuario tenga acceso a esa sucursal, setea la cookie y retorna la sucursal validada. El client actualiza el Zustand store (en memoria, sin persist) y emite via `BroadcastChannel` a las demas pestanas.

### 2. Zustand sin persist + hidratacion SSR

`useSucursalStore` pierde el middleware `persist`. El store se inicializa vacio y se hidrata en `layout.tsx` con los datos del fetch SSR (sucursales permitidas + sucursal activa leida de la cookie en server). Esto garantiza que el estado inicial siempre refleja lo que el server conoce, eliminando la rehydration prematura.

### 3. Invalidacion reactiva de suscripcion

El endpoint `/api/subscriptions/current` incluye headers `ETag` y `Cache-Control`. El client hace polling cada 60 segundos con `If-None-Match` (304 = sin cambios, bajo costo). Al detectar un cambio de plan, se invalida el cache local y se emite via `BroadcastChannel` a todas las pestanas. `SubscriptionGuard` consume el estado de la query directamente (no refs ni caches module-level).

## Areas afectadas

| Area | Impacto | Descripcion |
|------|---------|-------------|
| `src/store/useSucursalStore.ts` | Modificado | Eliminar middleware `persist`, eliminar sync a cookie/localStorage. Store solo en memoria, hidratado desde server props. |
| `src/lib/auth/require-auth.ts` | Modificado | Resolver `activeSucursalId` solo desde cookie HttpOnly. Eliminar fallback a header y JWT payload. |
| `src/lib/auth/core.ts` | Modificado | Remover `sucursalId` del payload JWT en `signToken`. Ajustar `verifyToken` para no esperar `sucursalId`. |
| `src/lib/apiService.ts` | Modificado | Eliminar header `x-sucursal-id` y parametro `__sid`. Las requests dependen de la cookie automatica. |
| `src/lib/sucursalScope.ts` | Modificado | Ajustar `isGlobalSucursalView` y `buildSucursalWhere` para tratamiento explicito de `id=0` sin depender de registro DB. |
| `src/lib/subscriptions/require-subscription.ts` | Modificado | Unificar queries para resolver suscripcion a nivel sistema/tenant. Agregar headers ETag en response. |
| `src/components/SubscriptionGuard.tsx` | Modificado | Eliminar `configCache` module-level y `checkedRef`. Consumir estado de query reactiva (React Query o fetch con polling). |
| `src/components/top-bar.tsx` | Modificado | Cambiar handler de seleccion de sucursal para llamar a `PUT /api/sucursal/active` en vez de setear cookie/header manualmente. |
| `src/components/sidebar-dock.tsx` | Modificado | Ajustar hidratacion del store — recibir datos de sucursales como props desde layout SSR. |
| `src/app/(system-guard)/(protected)/layout.tsx` | Modificado | Pasar sucursal activa y sucursales permitidas como props a los children. Leer cookie HttpOnly en server. |
| `src/app/api/auth/login/route.ts` | Modificado | Setear cookie HttpOnly `active_sucursal_id` al hacer login (sucursal por defecto del usuario). Remover `sucursalId` del JWT. |
| `src/app/api/auth/me/route.ts` | Modificado | Leer sucursal activa desde cookie en vez de JWT. |
| `src/app/api/sucursal/active/route.ts` | Nuevo | Endpoint `PUT` para cambiar sucursal activa: valida acceso, setea cookie HttpOnly, retorna sucursal. |
| `src/app/api/subscriptions/current/route.ts` | Modificado | Agregar headers ETag/Last-Modified. Resolver suscripcion a nivel sistema (no usuario). |
| `src/constants/subscriptions.ts` | Sin cambios | Los planes y limites se mantienen. Solo cambia como se consultan. |
| `src/components/global-readonly-guard.tsx` | Modificado | Ajustar deteccion de vista global para usar el nuevo patron sin depender de store persistido. |
| `src/hooks/useBroadcastChannel.ts` | Nuevo | Hook para sincronizar estado de sucursal y suscripcion entre pestanas via BroadcastChannel API. |
| `src/hooks/useSubscriptionPolling.ts` | Nuevo | Hook para polling de `/api/subscriptions/current` con ETag, invalida cache local al detectar cambio. |

## Riesgos

| Riesgo | Probabilidad | Mitigacion |
|--------|--------------|------------|
| **Sesion perdida al migrar cookie**: Usuarios activos pierden su sucursal seleccionada al deployar porque el JWT ya no la contiene y la cookie HttpOnly aun no existe. | Alta | Implementar fallback temporal: si la cookie no existe, leer `sucursalId` del JWT (legacy) y crear la cookie. Eliminar fallback en v2. |
| **BroadcastChannel no soportado en Safari < 15.4**: Usuarios en Safari antiguo no tendran sync entre pestanas. | Baja | BroadcastChannel tiene soporte 95%+. Degradacion graciosa: sin sync, cada pestana opera independiente (comportamiento actual). |
| **Polling de suscripcion agrega carga al server**: Cada pestana hace un request cada 60s. Con muchos usuarios concurrentes, puede ser significativo. | Media | ETag con `304 Not Modified` minimiza payload. El endpoint es ligero (query simple + comparacion de hash). Ajustar intervalo si se detecta carga. |
| **Race condition al cambiar sucursal**: Si el usuario cambia de sucursal mientras hay requests en vuelo, las responses pueden mezclar datos de ambas sucursales. | Media | El endpoint `PUT /api/sucursal/active` retorna la sucursal setteada. El client espera confirmacion antes de actualizar el store. Las requests en vuelo se descartan si la sucursal cambio (abort controller). |
| **Regresion en Vista Global**: La Vista Global (`id=0`) es usada por admins para ver datos consolidados. El refactor de `buildSucursalWhere` podria romper queries existentes. | Media | Tests dedicados para Vista Global. Revisar todas las llamadas a `buildSucursalWhere` y `isGlobalSucursalView` antes del deploy. |
| **Config `usarControlDeCaja` keyed por sucursal rompe config existente**: Usuarios que ya tienen la config en localStorage sin scope pierden la configuracion al migrar. | Baja | Migracion en el hook: si existe la key sin scope, copiarla a la key con scope de la sucursal activa y eliminar la key legacy. |

## Plan de Reversion (Rollback)

### Estrategia: Feature flag + compatibilidad dual temporal

1. **Feature flag `USE_NEW_SUCURSAL_FLOW`** (variable de entorno): Permite switchear entre el flujo nuevo (cookie HttpOnly) y el flujo legacy (header + JWT + localStorage) sin redespliegue de codigo.

2. **Periodo de compatibilidad dual** (1-2 semanas post-deploy):
   - `require-auth.ts` sigue aceptando el header `x-sucursal-id` como fallback si la cookie no existe.
   - El JWT sigue incluyendo `sucursalId` como campo opcional (no se usa para resolver, pero permite rollback).
   - `apiService.ts` mantiene el envio del header `x-sucursal-id` durante este periodo.

3. **Rollback completo**: Si se detectan problemas criticos:
   - Setear `USE_NEW_SUCURSAL_FLOW=false`.
   - El sistema vuelve al flujo anterior: header > cookie (document.cookie) > JWT.
   - Los endpoints nuevos (`/api/sucursal/active`) siguen disponibles pero no se usan.
   - `useSucursalStore` re-habilita `persist` via flag.

4. **Punto de no retorno**: Despues del periodo dual, se elimina el codigo legacy en un PR de limpieza separado.

## Dependencias

- **Next.js cookies API** (`cookies()` de `next/headers`): Para leer/escribir la cookie HttpOnly en server components y route handlers. Ya disponible en el stack actual.
- **BroadcastChannel API**: API nativa del browser, no requiere dependencias externas. Fallback: no sync entre pestanas (degradacion graciosa).
- **ETag generation**: Se necesita un hash (MD5 o similar) del estado de suscripcion para generar ETags. `crypto` de Node.js es suficiente.
- **React Query o SWR** (opcional): Para el polling reactivo de suscripcion. Alternativamente, se puede implementar con `useEffect` + `fetch` + `setInterval`, pero una libreria de data fetching simplifica la gestion de cache, revalidacion y estados de loading/error.

## Criterios de Exito

- [ ] **Zero fuentes de verdad duplicadas**: `activeSucursalId` se resuelve exclusivamente desde la cookie HttpOnly `active_sucursal_id` en el server. No existe fallback a header ni JWT payload.
- [ ] **Sin rehydration prematura**: `useSucursalStore` no usa `persist`. Al cargar la pagina, el store esta vacio hasta que el layout SSR lo hidrata con datos validados por el server.
- [ ] **Cambio de plan reflejado en < 60 segundos**: Despues de un upgrade/downgrade, todas las pestanas abiertas reflejan los nuevos limites del plan en menos de 60 segundos sin recargar.
- [ ] **Sincronizacion entre pestanas**: Cambiar de sucursal en una pestana actualiza las demas pestanas abiertas en menos de 1 segundo via BroadcastChannel.
- [ ] **Sin caches stale**: No existe `subscription_limits` en localStorage, ni `configCache` module-level. Todo cache tiene invalidacion explicita.
- [ ] **Configs scoped por sucursal**: `usarControlDeCaja` y cualquier otra config cacheada localmente estan keyed por `sucursalId`.
- [ ] **Vista Global funcional**: `getConfiguredTz` y `buildSucursalWhere` manejan `id=0` explicitamente sin query a DB por un registro inexistente.
- [ ] **Suscripcion unificada a nivel sistema**: Todas las queries de suscripcion resuelven al mismo registro (nivel tenant), independientemente del usuario que consulta.
- [ ] **`SubscriptionGuard` sin bypasses**: El guard no usa refs mutables ni caches module-level. Toda verificacion pasa por el estado de la query reactiva.
- [ ] **Rollback funcional**: El feature flag `USE_NEW_SUCURSAL_FLOW` permite revertir al flujo anterior sin perdida de datos ni redespliegue.
