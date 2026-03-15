# Diseno: Rediseno Deteccion de Sucursal y Paquetes

## Enfoque Tecnico

Rediseno completo del flujo de deteccion de sucursal activa y validacion de planes/suscripciones. La estrategia central es **eliminar la triple fuente de verdad** (localStorage persist, cookie, header) y reemplazarla con una **fuente unica: la cookie `active_sucursal_id`**, validada server-side en cada request. Los datos del plan se pasan como props desde el RSC layout, eliminando el cache stale module-level. La sincronizacion cross-tab se logra con BroadcastChannel API.

**Bugs que resuelve este rediseno:**
- Bug #1: Triple fuente de verdad (cookie vs localStorage vs header)
- Bug #2: Rehydration mismatch por Zustand persist
- Bug #3: Race conditions entre cookie write y primer fetch
- Bug #4: Cache stale de 5 minutos en SubscriptionGuard
- Bug #5: Config sin scope por sucursal (`usarControlDeCaja`)
- Bug #6: Falta de sincronizacion entre pestanas
- Bug #7-10: Derivados de los anteriores

## Decisiones de Arquitectura

### Decision: Fuente Unica de Verdad para Sucursal Activa

**Eleccion**: Cookie `active_sucursal_id` (no httpOnly, SameSite=Lax) como single source of truth. El server lee la cookie directamente. El client lee la cookie y la propaga via Zustand store SIN persist.

**Alternativas consideradas**:
- **Header-only**: No persiste entre navegaciones, requiere que el client lo envie siempre.
- **Server-side session**: Agrega complejidad y estado server-side que no necesitamos.
- **HttpOnly cookie**: Impide que JS la lea para UI (dropdown de sucursal).

**Justificacion**: La cookie no-httpOnly permite que JS la lea para UI (dropdown) y la escriba al cambiar sucursal, mientras que el server la lee directamente de `cookies()`. Elimina la necesidad del header `x-sucursal-id` como fuente primaria y del localStorage persist.

---

### Decision: Zustand Store sin Persist para Sucursal

**Eleccion**: Remover `persist` middleware del `useSucursalStore`. El store se hidrata UNICAMENTE desde server props en el layout SSR via `useEffect`.

**Alternativas consideradas**:
- **Mantener persist con versioning**: Sigue teniendo el problema de rehydration mismatch.
- **sessionStorage**: Menor duracion pero mismo problema fundamental.

**Justificacion**: El persist en localStorage es la causa raiz del bug de rehydration (Bug #2). Sin persist, el store empieza vacio y se llena con datos frescos del server en cada navegacion de layout. Esto garantiza consistencia entre server y client.

---

### Decision: Plan/Subscription como Server-Side Context

**Eleccion**: Los datos del plan activo (limits, features) se pasan como props desde el RSC layout a los client components. Un nuevo endpoint `/api/subscriptions/invalidate` usa BroadcastChannel + custom event para forzar re-validacion cross-tab.

**Alternativas consideradas**:
- **Mantener cache module-level**: Causa el bug de datos stale por 5 minutos.
- **React Context con polling**: Genera requests innecesarios y complejidad.

**Justificacion**: Elimina el cache stale de 5min del SubscriptionGuard. El layout SSR siempre tiene datos frescos de la DB. Para invalidacion en tiempo real (upgrade/downgrade), se usa BroadcastChannel.

---

### Decision: Cambio de Sucursal via API (no document.cookie)

**Eleccion**: Nuevo endpoint `POST /api/sucursal/switch` que valida permisos + setea la cookie server-side + retorna datos actualizados. El client llama este endpoint y luego hace `router.refresh()`.

**Alternativas consideradas**:
- **Seguir con `document.cookie` directo**: No valida permisos, genera race conditions.

**Justificacion**: El server valida que el usuario tiene permisos sobre esa sucursal antes de setear la cookie. Elimina race conditions entre cookie write y primer fetch. El `router.refresh()` garantiza que el layout RSC re-ejecute con la nueva cookie.

---

### Decision: Config Cacheada con Scope por Sucursal

**Eleccion**: `usarControlDeCaja` y otras configs se guardan en localStorage con key `config-{sucursalId}` en vez de key generica.

**Alternativas consideradas**:
- **No cachear**: Requiere fetch en cada render.
- **Cache global (sin scope)**: Es el Bug #5 actual.

**Justificacion**: Cada sucursal puede tener configuracion diferente. El key sin scope causa que al cambiar de sucursal se use la config de la sucursal anterior.

---

### Decision: Sincronizacion Cross-Tab

**Eleccion**: BroadcastChannel API para notificar cambios de sucursal y plan entre pestanas. Fallback a `storage` event para navegadores que no soporten BroadcastChannel.

**Alternativas consideradas**:
- **SharedWorker**: Mas complejo, requiere archivo worker separado.
- **Polling**: Ineficiente, genera requests innecesarios.

**Justificacion**: BroadcastChannel es nativo, liviano y soportado por todos los browsers modernos. El storage event es el fallback natural para los pocos navegadores sin soporte.

## Flujo de Datos

### Flujo de Deteccion de Sucursal (NUEVO)

```
    LOGIN (POST) -----> JWT (sub, email, rol, nombre, sucursalId)
         |                  \-- sucursalId = asignacion del empleado
         |
         v
    COOKIE 'active_sucursal_id' <--- seteada en login (= user.sucursalId)
         |
         v
    PROTECTED LAYOUT (RSC) -----> requireAuth()
         |                            |
         |                            |-- Lee cookie 'active_sucursal_id'
         |                            |-- ADMIN: valida que sid existe y esta activa
         |                            |-- EMPLEADO: ignora cookie, usa JWT sucursalId
         |                            \-- Retorna activeSucursalId validado
         |
         |-- getSidebarUserData()
         |       |-- sucursalesPermitidas (de DB)
         |       |-- planLimits (de DB, con allowConsignaciones, allowSucursales)
         |       \-- activeSucursalId (validado por server)
         |
         v
    CLIENT COMPONENTS
         |-- SidebarDock: useEffect hidrata useSucursalStore
         |       \-- set({ activeSucursalId, availableSucursales, planLimits })
         |
         |-- TopBar: lee store, dropdown cambia via POST /api/sucursal/switch
         |       \-- switch -> server valida -> set-cookie -> router.refresh()
         |
         |-- apiService: lee store.activeSucursalId para header x-sucursal-id
         |       (mantiene header para API calls client-side, ya no es fuente primaria)
         |
         \-- SubscriptionGuard: recibe planLimits como prop, no mas fetch propio
```

### Flujo de Cambio de Sucursal (NUEVO)

```
    Usuario click en TopBar dropdown
         |
         v
    POST /api/sucursal/switch  { sucursalId: N }
         |
         |-- requireAuth() -> verifica es ADMIN
         |-- Verifica sucursal existe y esta activa
         |-- Set-Cookie: active_sucursal_id=N
         |-- BroadcastChannel.postMessage({ type: 'sucursal-changed', id: N })
         \-- Return 200 { ok: true, activeSucursalId: N }
         |
         v
    Client recibe respuesta
         |
         |-- useSucursalStore.setState({ activeSucursalId: N })
         |-- router.refresh()  -> layout RSC re-ejecuta con nueva cookie
         \-- Otras pestanas reciben BroadcastChannel message
              \-- Actualizan store + router.refresh()
```

### Flujo de Validacion de Suscripcion (NUEVO)

```
    PROTECTED LAYOUT (RSC)
         |
         |-- getActivePlanLimits() -> de DB, siempre fresh
         |-- Pasa planLimits como prop a SubscriptionGuard
         |
         v
    SubscriptionGuard (client)
         |
         |-- Recibe planLimits como prop (no fetch propio)
         |-- Si !planLimits -> redirect /settings/subscriptions
         |-- Escucha BroadcastChannel 'plan-changed'
         \-- Al recibir 'plan-changed' -> router.refresh()
```

## Cambios en Archivos

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| `src/store/useSucursalStore.ts` | Modificar | Remover `persist` middleware. Agregar `planLimits` al state. Agregar metodo `hydrate()` para server props. Agregar BroadcastChannel listener. |
| `src/lib/auth/require-auth.ts` | Modificar | Simplificar: ADMIN lee solo cookie. EMPLEADO siempre JWT. Eliminar lectura de header `x-sucursal-id`. Validar que sucursal existe en DB. |
| `src/lib/apiService.ts` | Modificar | Mantener header `x-sucursal-id` para API calls (leido del store), pero remover `__sid` query param y logica de cache condicional. |
| `src/components/SubscriptionGuard.tsx` | Modificar | Eliminar cache module-level. Recibir `planLimits` como prop desde layout. Agregar BroadcastChannel listener para invalidacion. |
| `src/components/top-bar.tsx` | Modificar | Cambio de sucursal via `POST /api/sucursal/switch` + `router.refresh()` en vez de `setActiveSucursalId()` directo. |
| `src/components/sidebar-dock.tsx` | Modificar | Hidratar store con `planLimits` ademas de `sucursalesPermitidas`. Remover localStorage de `usarControlDeCaja` (usar config scoped). |
| `src/components/global-readonly-guard.tsx` | Sin cambios | Sigue funcionando igual leyendo del store. |
| `src/app/(system-guard)/(protected)/layout.tsx` | Modificar | Pasar `planLimits` como prop a SubscriptionGuard. Agregar `activeSucursalId` a las props. |
| `src/app/api/auth/login/route.ts` | Modificar | Setear cookie `active_sucursal_id` al login con el `sucursalId` del usuario. |
| `src/app/api/sucursal/switch/route.ts` | **Crear** | Nuevo endpoint: valida permisos, setea cookie server-side, retorna confirmacion. |
| `src/lib/broadcast-channel.ts` | **Crear** | Utilidad para BroadcastChannel con fallback a storage event. Mensajes: `sucursal-changed`, `plan-changed`, `logout`. |
| `src/hooks/useBroadcastChannel.ts` | **Crear** | Hook React para escuchar mensajes del BroadcastChannel y ejecutar callbacks. |
| `src/lib/subscriptions/require-subscription.ts` | Modificar | Sin cambios funcionales, pero agregar memoizacion con `React.cache` para evitar queries duplicadas en el mismo request. |
| `src/app/api/subscriptions/current/route.ts` | Modificar | Agregar `planLimits` al response para que el layout pueda pasarlos como prop. |

## Interfaces / Contratos

### Nuevo endpoint POST /api/sucursal/switch

```ts
// Request
interface SwitchSucursalRequest {
  sucursalId: number; // 0 para vista global (solo ADMIN)
}

// Response 200
interface SwitchSucursalResponse {
  ok: true;
  activeSucursalId: number;
}

// Response 403
interface SwitchSucursalError {
  error: "No autorizado para esta sucursal";
}
```

### Nuevo Zustand Store (sin persist)

```ts
interface SucursalState {
  // --- Sucursal ---
  activeSucursalId: number;
  availableSucursales: Sucursal[];
  isHydrated: boolean; // true despues de recibir datos del server

  // --- Plan/Subscription ---
  planLimits: PlanLimits | null;

  // --- UI State ---
  pedidosVencidosCount: number;

  // --- Actions ---
  hydrate: (data: HydratePayload) => void;
  switchSucursal: (id: number) => Promise<void>; // llama POST /api/sucursal/switch
  setPedidosVencidosCount: (count: number) => void;
}
```

### BroadcastChannel Messages

```ts
type BroadcastMessage =
  | { type: 'sucursal-changed'; sucursalId: number }
  | { type: 'plan-changed' }
  | { type: 'session-revoked' };
```

### Layout Props (ampliadas)

```ts
interface SidebarUserData {
  rol: "ADMIN" | "EMPLEADO";
  sucursalesPermitidas: Sucursal[];
  activeSucursalId: number;   // NUEVO: validado por server
  planLimits: PlanLimits | null; // NUEVO: limits del plan activo
}
```

## Estrategia de Pruebas

| Capa | Que Probar | Enfoque |
|------|------------|---------|
| Unitaria | `require-auth.ts` -- resolucion de sucursal desde cookie | Vitest + mock de `cookies()` |
| Unitaria | `useSucursalStore.ts` -- hydrate, switchSucursal | Vitest + `act()` |
| Unitaria | BroadcastChannel utility -- send/receive/fallback | Vitest con mock |
| Integracion | `POST /api/sucursal/switch` -- validacion + set-cookie | Vitest con supertest |
| Integracion | Cambio de plan -> invalidacion cross-tab | Cypress/Playwright |
| E2E | Login -> cambiar sucursal -> verificar datos | Playwright |
| E2E | Upgrade plan -> features habilitadas inmediato | Playwright |

## Migracion / Despliegue

1. **Sin migracion de DB**: No hay cambios en schema Prisma.
2. **Backward compatible**: La cookie `active_sucursal_id` ya existe, solo cambiamos quien la escribe.
3. **Feature flag**: No necesario, el cambio es transparente.
4. **Despliegue**: Single deploy, no requiere fases.
5. **Cleanup post-deploy**: Remover `sucursal-storage` de localStorage en la primera carga (migration code en el store):

```ts
// En la inicializacion del nuevo store (sin persist)
if (typeof window !== 'undefined') {
  localStorage.removeItem('sucursal-storage');
}
```

## Preguntas Abiertas

Ninguna. El diseno esta completo basado en el analisis exhaustivo del codigo actual.
