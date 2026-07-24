# 📋 Documentación de Flujos: Detección de Sucursal y Paquetes

**Proyecto:** Consignación App  
**Fecha:** 15 de Marzo de 2026  
**Autor:** JARVIS (Orquestador SDD)  
**Versión:** 1.0.0 (Rediseño Completo)

---

## 🎯 Resumen Ejecutivo

Este documento describe los **flujos completos** del sistema de detección de sucursal y verificación de paquetes/planes, resultantes del rediseño completo implementado en la sesión anterior.

**Bugs Resueltos (10):**

1. Triple fuente de verdad (header/cookie/JWT) → Single Source of Truth: cookie httpOnly
2. Zustand rehydration prematura → Store sin persist, hidratación SSR
3. Cache stale SubscriptionGuard (5min) → PlanLimits como prop desde layout
4. subscription_limits en localStorage → Eliminado
5. JWT sucursalId hardcoded 7 días → Removido del payload
6. usarControlDeCaja sin scope → Key scoped por sucursalId
7. Vista Global (id=0) inconsistente → Tratamiento explícito
8. Sin sync entre pestañas → BroadcastChannel API
9. Race conditions entre cookie write y primer fetch → Validación server-side
10. checkedRef.current bypass en SubscriptionGuard → Eliminado

---

## 🏗️ Arquitectura del Sistema

### Componentes Principales

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER CLIENT                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│  │  useSucursalStore    │  │  useBroadcastChannel │  │  Subscription   │  │
│  │  (Zustand, sin persist)│ │  (Hook React)        │  │  Guard (Props)  │  │
│  └──────────────────────┘  └──────────────────────┘  └──────────────────┘  │
│           │                       │                          │              │
│           └───────────────────────┼──────────────────────────┘              │
│                                   │                                         │
└───────────────────────────────────┼─────────────────────────────────────────┘
                                    │
                                    ▼ HTTP/HTTPS
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NEXT.JS SERVER (API Routes)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│  │  require-auth.ts     │  │  /api/auth/login     │  │ /api/sucursal/   │  │
│  │  (Server Auth Guard) │  │  (POST: Login)       │  │  switch (POST)   │  │
│  └──────────────────────┘  └──────────────────────┘  └──────────────────┘  │
│           │                       │                          │              │
│           └───────────────────────┼──────────────────────────┘              │
│                                   │                                         │
└───────────────────────────────────┼─────────────────────────────────────────┘
                                    │
                                    ▼ Prisma/PostgreSQL
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BASE DE DATOS (PostgreSQL)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│  │  Usuario (id, rol,   │  │  Sucursal (id, nombre│  │ Subscription    │  │
│  │  sucursalId, activo) │  │  activa, esPrincipal)│  │ (userId, planId) │  │
│  └──────────────────────┘  └──────────────────────┘  └──────────────────┘  │
│  ┌──────────────────────┐  ┌──────────────────────┐                        │
│  │  Plan (id, nombre,   │  │  PlanLimits          │                        │
│  │  precio, features)   │  │  (maxProductos, etc) │                        │
│  └──────────────────────┘  └──────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔑 Flujos Principales

### FLOW 1: Login y Detección Inicial de Sucursal

**Objetivo:** Autenticar usuario y establecer la sucursal activa mediante cookie.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FLOW 1: LOGIN + DETECCIÓN INICIAL SUCURSAL                                 │
└─────────────────────────────────────────────────────────────────────────────┘

1. Browser → POST /api/auth/login
   └─► { email: "xxxxx@gmail.com", password: "xxxxxxx" }

2. Server → Validate credentials
   └─► require-auth.ts: Verifica email/password en DB
       └─► user.rol, user.sucursalId, user.activo

3. Server → Generate JWT (signUserJwt)
   └─► JWT payload: { sub, email, rol, nombre }
       └─► NOTA: sucursalId ELIMINADO del JWT (bug #5 solucionado)

4. Server → Set cookies
   └─► Cookie JWT: httpOnly (para auth)
   └─► Cookie active_sucursal_id: user.sucursalId (para UI y API)

5. Browser → Store hydrate
   └─► useSucursalStore.hydrate({
         activeSucursalId: user.sucursalId,
         availableSucursales: [...],
         planLimits: await getActivePlanLimits()
       })

6. UI → Redirigir a Dashboard
   └─► SidebarDock muestra sucursales permitidas
   └─► TopBar muestra dropdown con sucursales

★ Cookie active_sucursal_id ES LA ÚNICA FUENTE DE VERDAD para sucursal activa
```

**Archivos Involved:**

- `src/app/api/auth/login/route.ts` (líneas 35-41, 43-44)
- `src/lib/auth/require-auth.ts` (resolve sucursal desde cookie)
- `src/lib/auth/core.ts` (signUserJwt, setAuthCookie)
- `src/store/useSucursalStore.ts` (hydrate action)

---

### FLOW 2: Cambio de Sucursal por Administrador

**Objetivo:** Cambiar sucursal activa validando permisos y sincronizando pestañas.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FLOW 2: CAMBIO DE SUCURSAL (Admin)                                        │
└─────────────────────────────────────────────────────────────────────────────┘

1. Browser → User hace click en dropdown de sucursales (TopBar)
   └─► handleSwitch(nuevaSucursalId)

2. Browser → POST /api/sucursal/switch
   └─► Body: { sucursalId: 2 }

3. Server → requireAuth() + validate
   └─► Verificar JWT válido
   └─► Verificar user.rol === "ADMIN" (empleados no pueden cambiar)

4. Server → Validar sucursal
   └─► Si sucursalId > 0: Query Prisma
       └─► SELECT * FROM Sucursal WHERE id = N AND activa = true
   └─► Si sucursalId === 0: Vista Global (solo admins)

5. Server → Setear cookie
   └─► response.cookies.set("active_sucursal_id", N, {
         path: "/",
         maxAge: 30 * 24 * 60 * 60,
         sameSite: "lax"
       })

6. Server → Return response
   └─► { ok: true, activeSucursalId: N }

7. Browser → Update store
   └─► useSucursalStore.switchSucursal() receives response
   └─► set({ activeSucursalId: N })
   └─► postAppMessage({ type: "sucursal-changed", sucursalId: N })

8. Browser → Cross-tab sync
   └─► BroadcastChannel.postMessage("sucursal-changed")
   └─► Otras pestañas reciben mensaje y ejecutan router.refresh()

9. Server → RSC Re-render
   └─► Layout re-ejecuta con nueva cookie
   └─► Actualiza sucursalesPermitidas según user.rol

★ BroadcastChannel usa fallback a StorageEvent si navegador no soporta BC
```

**Archivos Involved:**

- `src/app/api/sucursal/switch/route.ts` (endpoint completo)
- `src/components/top-bar.tsx` (handleSwitch async)
- `src/store/useSucursalStore.ts` (switchSucursal action)
- `src/lib/broadcast-channel.ts` (postAppMessage)
- `src/hooks/useBroadcastChannel.ts` (escucha cambios)

---

### FLOW 3: Detección de Paquete/Plan por Sucursal

**Objetivo:** Obtener límites y features del plan activo para una sucursal.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FLOW 3: DETECCIÓN DE PLAN/LIMITES                                         │
└─────────────────────────────────────────────────────────────────────────────┘

1. Server → Protected Layout RSC (load inicial)
   └─► requireAuth() → Obtiene userId, activeSucursalId desde cookie

2. Server → getSidebarUserData()
   └─► Query 1: Find user con subscription y plan limits
       └─► SELECT u.*, s.*, p.*, pl.*
           FROM Usuario u
           LEFT JOIN Subscription s ON s.userId = u.id
           LEFT JOIN Plan p ON p.id = s.planId
           LEFT JOIN PlanLimits pl ON pl.planId = p.id
           WHERE u.id = ? AND u.activo = true

   └─► Query 2: Find sucursales permitidas
       └─► Si ADMIN: SELECT * FROM Sucursal WHERE activa = true
       └─► Si EMPLEADO: SELECT * FROM Sucursal WHERE id = user.sucursalId

3. Server → getActivePlanLimits()
   └─► Wrappear con React.cache() para deduplicación
   └─► Retorna PlanLimits | null

4. Server → Pasar a Layout
   └─► SidebarUserData = {
         rol: user.rol,
         sucursalesPermitidas: [...],
         activeSucursalId: activeSucursalId,
         planLimits: await getActivePlanLimits()
       }

5. Client → SubscriptionGuard (Props)
   └─► Recibe planLimits como prop (NO fetch propio)
   └─► Si !planLimits y NOT /settings/subscriptions → redirect

6. Client → useSucursalStore.hydrate()
   └─► store.planLimits = userData.planLimits
   └─► store.activeSucursalId = userData.activeSucursalId

★ React.cache() evita queries duplicadas dentro del mismo request tree
```

**Archivos Involved:**

- `src/app/(system-guard)/(protected)/layout.tsx` (getSidebarUserData)
- `src/lib/subscriptions/require-subscription.ts` (getActivePlanLimits con cache)
- `src/components/SubscriptionGuard.tsx` (recibe props, NO fetch)
- `src/store/useSucursalStore.ts` (hydrate con planLimits)

---

### FLOW 4: Validación de Features (Server-Side)

**Objetivo:** Verificar si el plan actual permite una acción específica.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FLOW 4: VALIDACIÓN DE FEATURES (Server)                                    │
└─────────────────────────────────────────────────────────────────────────────┘

1. Request → API Route / endpoint protegido
   └─► requireAuth() → Obtiene userId y activeSucursalId

2. Server → getActivePlanLimits()
   └─► query PlanLimits para subscription activa
   └─► Retorna: {
         maxProductos: -1 (ilimitado),
         maxUsuarios: 100,
         allowConsignaciones: true,
         allowSucursales: true,
         planId: 3,
         planNombre: "Enterprise"
       }

3. Server → checkFeature(featureName)
   └─► Si feature: "allowSucursales" → Verifica planLimits.allowSucursales
   └─► Si feature: "maxProductos" → Verifica cantidad actual vs límite

4. Server → Denegar o Permitir
   └─► Si no cumple → Return error 403/400
   └─► Si cumple → Continuar con request

★ Todas las validaciones son server-side, nunca client-side
```

**Archivos Involved:**

- `src/lib/subscriptions/require-subscription.ts` (checkFeature, checkProductLimit)
- `src/app/api/subscriptions/current/route.ts` (incluye planLimits en response)

---

### FLOW 5: Vista Global (sucursalId = 0)

**Objetivo:** Mostrar datos consolidados de todas las sucursales (solo ADMIN).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FLOW 5: VISTA GLOBAL (ID = 0)                                             │
└─────────────────────────────────────────────────────────────────────────────┘

1. Server → requireAuth()
   └─► user.rol === "ADMIN" (obligatorio para vista global)

2. Server → POST /api/sucursal/switch { sucursalId: 0 }
   └─► Valida: sucursalId === 0 → solo ADMIN permitido

3. Server → Set cookie active_sucursal_id = "0"
   └─► response.cookies.set("active_sucursal_id", "0", {...})

4. Browser → useSucursalStore
   └─► activeSucursalId = 0
   └─► isGlobalView = true

5. Client → GlobalReadonlyGuard
   └─► Bloquea acciones mutantes (nuevo, guardar, eliminar)
   └─► Muestra toast: "Vista global: solo lectura"

6. Queries → buildSucursalWhere()
   └─► Si sucursalId === 0 → No filtra por sucursal
   └─► Si sucursalId > 0 → Filtra WHERE sucursalId = N

★ Vista Global usa ID 0 (no existe en tabla Sucursal)
```

**Archivos Involved:**

- `src/app/api/sucursal/switch/route.ts` (validación sucursalId === 0)
- `src/components/global-readonly-guard.tsx` (bloqueo de UI)
- `src/lib/sucursalScope.ts` (buildSucursalWhere, isGlobalSucursalView)

---

### FLOW 6: Sincronización Cross-Tab (BroadcastChannel)

**Objetivo:** Mantener sincronizadas múltiples pestañas del navegador.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FLOW 6: SINCRONIZACIÓN CROSS-TAB                                          │
└─────────────────────────────────────────────────────────────────────────────┘

SCENARIO: Usuario cambia sucursal en Pestaña A

1. Pestaña A → POST /api/sucursal/switch
   └─► Server setea cookie active_sucursal_id = N

2. Pestaña A → useSucursalStore.switchSucursal()
   └─► postAppMessage({ type: "sucursal-changed", sucursalId: N })
   └─► BroadcastChannel.postMessage(message)

3. Pestañas B, C, D → useBroadcastChannel hook
   └─► Escucha: "sucursal-changed"
   └─► Handler: router.refresh()

4. Todas las pestañas → Server re-render
   └─► Layout RSC ejecuta con nueva cookie
   └─► Store se rehidrata con datos actualizados

FALLBACK: Si navegador no soporta BroadcastChannel
   └─► Usa localStorage event (storage event listener)
   └─► Guarda mensaje temporal, otras pestañas lo leen

MENSAJES SUPPORTED:
   - sucursal-changed: Cambio de sucursal
   - plan-changed: Cambio de plan/subscription
   - session-revoked: Logout o sesión expirada
```

**Archivos Involved:**

- `src/lib/broadcast-channel.ts` (Channel API + fallback)
- `src/hooks/useBroadcastChannel.ts` (Hook React para escuchar)
- `src/store/useSucursalStore.ts` (postAppMessage en switchSucursal)
- `src/components/sidebar-dock.tsx` (escucha y refresca)

---

### FLOW 7: Cambio de Plan/Subscription

**Objetivo:** Detectar cambios de plan y refrescar UI en tiempo real.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FLOW 7: CAMBIO DE PLAN/SCRIPTION                                          │
└─────────────────────────────────────────────────────────────────────────────┘

SCENARIO: Usuario hace upgrade de Pro a Enterprise

1. Browser → POST /api/setup/create-mp-subscription
   └─► Crea subscription en DB con planId = 3 (Enterprise)

2. Server → Webhook MercadoPago/PayPal
   └─► Confirma pago exitoso
   └─► Actualiza subscription.status = "ACTIVO"

3. Browser → Componente de confirmación
   └─► postAppMessage({ type: "plan-changed" })
   └─► BroadcastChannel.postMessage("plan-changed")

4. Todas las pestañas → useBroadcastChannel
   └─► Escucha: "plan-changed"
   └─► router.refresh()

5. Server → Protected Layout RSC
   └─► getActivePlanLimits() → Nuevos límites Enterprise
   └─► Pasa nuevos planLimits a SubscriptionGuard

6. Client → SubscriptionGuard
   └─► Recibe nuevos planLimits
   └─► Features habilitadas inmediatamente (sin 5min cache)

★ Se eliminó cache module-level de 5 minutos (bug #3 solucionado)
```

**Archivos Involved:**

- `src/app/(system-guard)/(protected)/settings/subscriptions/page.tsx`
- `src/components/SubscriptionStatusCard.tsx`
- `src/components/SubscriptionGuard.tsx`
- `src/hooks/useBroadcastChannel.ts`

---

### FLOW 8: Migración de localStorage Legacy

**Objetivo:** Limpiar caches viejos en primera hidratación.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FLOW 8: MIGRACIÓN DE LOCALSTORAGE (Limpieza)                               │
└─────────────────────────────────────────────────────────────────────────────┘

PRIMER ACCESO DESPUÉS DEL DEPLOY:

1. Browser → Protected Layout RSC
   └─► getSidebarUserData() → Datos frescos desde DB

2. Client → useSucursalStore.hydrate()
   └─► Limpiar localStorage legacy:
       - localStorage.removeItem("sucursal-storage")  // Store viejo
       - localStorage.removeItem("subscription_limits")  // Cache stale
       - localStorage.removeItem("usarControlDeCaja")  // Sin scope

3. Client → Store limpio
   └─► activeSucursalId desde server (NO desde localStorage)
   └─► availableSucursales desde server (NO desde localStorage)
   └─► planLimits desde server (NO desde localStorage)

4. Subsesquentes accesos
   └─► Store siempre hidratado desde SSR
   └─► Sin rehydration prematura (bug #2 solucionado)

★ La migración solo ocurre en el PRIMER hydrate() después del deploy
```

**Archivos Involved:**

- `src/store/useSucursalStore.ts` (hydrate action + cleanup)
- `src/components/sidebar-dock.tsx` (llama hydrate en useEffect)

---

## 📋 Decisiones de Arquitectura

### Decisión 1: Cookie como Single Source of Truth

**Problema:** Triple fuente de verdad (header x-sucursal-id, cookie, JWT) causaba desincronización.

**Solución:** `active_sucursal_id` como única fuente.

```
ANTES:
  - Header x-sucursal-id (client envía)
  - Cookie document.cookie (client escribe)
  - JWT sucursalId (server fijo 7 días)

DESPUÉS:
  - Cookie active_sucursal_id (server escribe, client lee)
  - Cookie NO httpOnly (para que JS la lea en UI)
  - Server valida siempre desde cookies()
```

**Justificación:** La cookie viaja automáticamente con cada request, no necesita lógica manual en apiService.ts.

---

### Decisión 2: Zustand sin Persist

**Problema:** Rehydration prematura desde localStorage causaba estado inconsistente.

**Solución:** Store solo en memoria, hidratado desde SSR.

```
ANTES:
  - persist middleware → localStorage
  - Rehidrata ANTES del server validar permisos
  - Empleado reasignado ve sucursales antiguas

DESPUÉS:
  - Sin persist middleware
  - Store vacío inicialmente
  - hydrate() llamado desde layout RSC con datos validados
```

**Justificación:** Garantiza consistencia total entre server y client.

---

### Decisión 3: PlanLimits como Prop (Server-Side)

**Problema:** SubscriptionGuard con cache module-level de 5min causaba features stale.

**Solución:** PlanLimits como prop desde layout RSC.

```
ANTES:
  - SubscriptionGuard fetch /api/subscriptions/current
  - Cache module-level: 5min
  - Downgrade no se refleja hasta expirar cache

DESPUÉS:
  - Layout fetch getActivePlanLimits() en RSC
  - Pasa como prop a SubscriptionGuard
  - BroadcastChannel invalida en tiempo real
```

**Justificación:** El layout RSC siempre tiene datos frescos de DB.

---

### Decisión 4: BroadcastChannel con Fallback

**Problema:** Cambios en una pestaña no se reflejan en otras.

**Solución:** BroadcastChannel API + StorageEvent fallback.

```
PRIMARIO (95% browsers):
  - BroadcastChannel.postMessage()
  - Escucha: channel.addEventListener("message", ...)

FALLBACK (browsers antiguos):
  - localStorage.setItem(__broadcast_KEY, ...)
  - storage event listener
  - Limpiar inmediatamente después de leer
```

**Justificación:** Nativo, liviano, soportado por todos los navegadores modernos.

---

## 📁 Archivos del Sistema

### Archivos Nuevos

| Archivo                                | Líneas | Propósito                         |
| -------------------------------------- | ------ | --------------------------------- |
| `src/lib/broadcast-channel.ts`         | 60     | Utilidad Channel API con fallback |
| `src/hooks/useBroadcastChannel.ts`     | 44     | Hook React para escuchar mensajes |
| `src/app/api/sucursal/switch/route.ts` | 62     | Endpoint POST cambio de sucursal  |

### Archivos Modificados Principales

| Archivo                                | Cambios   | Propósito                                      |
| -------------------------------------- | --------- | ---------------------------------------------- |
| `src/store/useSucursalStore.ts`        | +116/-116 | Store sin persist, hydrate(), switchSucursal() |
| `src/lib/auth/require-auth.ts`         | +18/-18   | Solo cookie para ADMIN, JWT para EMPLEADO      |
| `src/components/SubscriptionGuard.tsx` | +74/-74   | Recibe planLimits como prop                    |
| `src/components/sidebar-dock.tsx`      | +28/-28   | hydrate() + BroadcastChannel                   |
| `src/components/top-bar.tsx`           | +40/-40   | switchSucursal async + loading                 |

---

## 🔍 Cómo Funciona el Sistema (Resumen Ejecutivo)

### Para un Administrador:

1. **Login** → Cookie `active_sucursal_id` seteada con sucursal principal
2. **Cambiar sucursal** → Click en TopBar → POST /api/sucursal/switch
3. **Ver Vista Global** → Seleccionar "Todas las sucursales" (id=0)
4. **Ver Paquetes** → Ve plan actual (Enterprise: múltiples sucursales)

### Para un Empleado:

1. **Login** → Cookie `active_sucursal_id` = su sucursal asignada
2. **Cambiar sucursal** → NO DISPONIBLE (403 error)
3. **Ver sucursales** → Solo ve su sucursal asignada
4. **Ver Paquetes** → Ve plan actual de la empresa

### Para el Sistema (Automático):

1. **Sync cross-tab** → BroadcastChannel notifica cambios en tiempo real
2. **Cambio de plan** → BroadcastChannel "plan-changed" refresca UI
3. **Migración** → Limpia caches viejos en primer acceso
4. **Validación** → Todas las verificaciones son server-side

---

## 🎯 Flujos de Negocio Específicos

### Flujo: Empleado Reasignado

**Problema:** Antes, el JWT tenía sucursalId fijo por 7 días.

**Solución Actual:**

1. Admin actualiza `usuario.sucursalId` en DB
2. Empleado hace logout/login → Cookie nueva con sucursal actualizada
3. No depende de expiración de JWT

### Flujo: Downgrade de Plan

**Problema:** Antes, subscription_limits en localStorage no se invalidaba.

**Solución Actual:**

1. Pago cancelado → subscription.status = "CANCELADO"
2. BroadcastChannel "plan-changed" → router.refresh()
3. Nuevo planLimits desde DB → features se actualizan inmediatamente

### Flujo: Multi-pestañas

**Problema:** Cambio en una pestaña no se reflejaba en otras.

**Solución Actual:**

1. Cambio sucursal/plan → BroadcastChannel.postMessage()
2. Todas las pestañas reciben mensaje
3. Cada una hace router.refresh() → datos actualizados

---

## 🚀 Próximos Pasos

### Testing Adicional (Opcional)

```bash
# 1. Test E2E con Playwright/Cypress
npm run test:e2e

# 2. Test de carga concurrente
#   - 10 usuarios cambiando sucursal simultáneamente
#   - Verificar que no hay race conditions

# 3. Test de compatibilidad browser
#   - Safari < 15.4 (BroadcastChannel fallback)
#   - Firefox/Chrome/Edge (BroadcastChannel nativo)
```

### Monitorización (Recomendado)

1. **Logs de cambios de sucursal**
   - Registrar cada cambio en auditoría
   - Track de who changed what y cuándo

2. **Performance de BroadcastChannel**
   - Monitorear uso de StorageEvent fallback
   - Ajustar si hay muchos usuarios en navegadores antiguos

3. **Errores de auth**
   - Alerta si hay muchos intentos de cambio no autorizados

---

## 📚 Referencias

### Documentación del Change

- `openspec/changes/rediseno-deteccion-sucursal/proposal.md` (150 líneas)
- `openspec/changes/rediseno-deteccion-sucursal/design.md` (278 líneas)
- `openspec/changes/rediseno-deteccion-sucursal/tasks.md` (63 líneas, 32 tareas)

### Código Fuente

- Commit: `4a4ee81` feat: Rediseño detección sucursal y paquetes
- Remote: https://github.com/fpx2117/consignacion-app

---

**Fin de Documentación** ✅

_Documento generado por JARVIS (Orquestador SDD) - 15/03/2026_
