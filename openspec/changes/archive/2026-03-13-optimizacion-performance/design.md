# Diseño: Optimización de Performance

**Cambio**: `optimizacion-performance`
**Fecha**: 2026-03-13
**Estado**: Borrador

---

## Enfoque Técnico

El sistema actual es 100% Client-Side Rendered para todas las rutas protegidas. Cada navegación incurre en:
1. Un fetch de autenticación contra la base de datos (sin caché)
2. Un spinner bloqueante del `SubscriptionGuard` que oculta toda la UI
3. Cuatro fetches de dashboard en paralelo iniciados desde el cliente (sin caché de datos)
4. Imágenes sin optimización (`<img>` nativo), sin lazy-loading automático ni WebP

La estrategia es aplicar mejoras en 7 fases progresivas e independientes, ordenadas por impacto/riesgo. Las fases 1–3 son prerequisito de la 7. Las fases 4–6 son independientes entre sí y pueden ejecutarse en paralelo.

---

## Decisiones de Arquitectura

### Decisión 1: `loading.tsx` como mecanismo primario de UX (Fase 1)

**Elección**: Crear archivos `loading.tsx` por ruta usando el Suspense automático de Next.js App Router.

**Alternativas consideradas**:
- Skeletons inline dentro de cada `page.tsx` client component (requiere estado de carga manual)
- Un spinner global centralizado (ya existe y es el problema actual)

**Justificación**: `loading.tsx` se activa automáticamente durante la navegación entre rutas (Server Component suspendido o `dynamic = "force-dynamic"`). No requiere modificar `page.tsx` existentes. Entrega feedback visual inmediato antes de que el JS del cliente cargue. Es la intervención de menor riesgo y mayor impacto percibido.

---

### Decisión 2: Memoización per-request de `requireAuth()` (Fase 2)

**Elección**: Envolver `requireAuth()` con `cache()` de React para deduplicar llamadas dentro del mismo request/render.

**Alternativas consideradas**:
- `Map<token, result>` global con TTL (cache cross-request): riesgo de datos stale entre usuarios, complejidad de invalidación
- Redis/Upstash para cache distribuido: overhead operacional innecesario para el problema actual (el problema es deduplicación dentro de UN request, no entre requests)
- Middleware de Next.js con `jose` para verificación sin DB: requiere refactor del sistema de sesiones

**Justificación**: `cache()` de React es el patrón recomendado por Next.js para deduplicar fetches de datos dentro del mismo render tree. No persiste entre requests (no hay riesgo de leak entre sesiones), es determinista, y requiere cambio mínimo: envolver la función existente. El layout `(protected)` ya es Server Component, por lo que aplica directamente.

**Nota crítica**: `requireAuth()` actualmente usa `dynamic import` de Prisma y `next/headers`. Ambos son compatibles con `cache()` de React.

---

### Decisión 3: Verificación de suscripción movida al Server Component layout (Fase 3)

**Elección**: Mover la verificación de suscripción del `SubscriptionGuard` (Client Component con spinner) al `ProtectedLayout` (Server Component).

**Alternativas consideradas**:
- Moverlo al middleware de Next.js: el middleware tiene acceso limitado (no puede importar Prisma), requería un fetch HTTP interno, duplicando la lógica ya presente en el layout
- Mantener el guard como client component pero sin bloqueante: muestra contenido y redirige post-hydration, causando flash de contenido prohibido

**Justificación**: El layout ya es un Server Component que ejecuta `checkAuth()`. Agregar una verificación de suscripción en el mismo request (o reutilizando el token validado) elimina el round-trip adicional del cliente. El `SubscriptionGuard` cliente puede convertirse en un componente vacío o eliminarse. La redirección server-side con `redirect()` es atómica (no hay flash).

---

### Decisión 4: `unstable_cache` para KPIs del Dashboard (Fase 4)

**Elección**: Envolver `getDashboardKpis()` con `unstable_cache` de Next.js con `revalidate: 60` y tags `['dashboard', 'kpis', 'sucursal-{id}']`.

**Alternativas consideradas**:
- `React.cache()`: solo dura per-request, no reduce queries a la DB entre distintos usuarios/requests
- `revalidatePath` manual tras mutaciones: complementario, no alternativa
- Aumentar el `revalidate` a 300s: los datos financieros con 5 minutos de stale pueden ser engañosos para operaciones críticas

**Justificación**: 60 segundos de TTL es el balance correcto para un POS activo. Los KPIs son datos analíticos (no transaccionales en tiempo real). La función ya recibe `sucursalId` y `period` como parámetros, lo que permite cache keys granulares. Se debe incluir `sucursalId` en la cache key para no mezclar datos entre sucursales.

**Limitación conocida**: `unstable_cache` es API estable en Next.js 15 pese al nombre. No requiere migración futura.

---

### Decisión 5: Migración `<img>` → `next/image` (Fase 5)

**Elección**: Reemplazar tags `<img>` nativos por `<Image>` de `next/image` donde el src sea una URL de archivo propio. Para avatares/íconos de terceros con URLs dinámicas, usar `unoptimized` prop o agregar los dominios a `remotePatterns`.

**Alternativas consideradas**:
- `@unpic/react`: alternativa multi-CDN, pero es dependencia extra innecesaria cuando Next.js ya provee optimización
- Mantener `<img>` con `loading="lazy"` manual: no genera WebP automático, no tiene placeholder blur

**Justificación**: El `next.config.ts` ya tiene `remotePatterns` configurado para `localhost/api/files/**`. Solo se necesita agregar el dominio de producción y migrar los tags. Los archivos de imagen del proyecto están en `/api/files/` y Cloudinary/similar si hay uploads externos.

---

### Decisión 6: Lazy loading de bibliotecas pesadas con `next/dynamic` (Fase 5)

**Elección**: Usar `dynamic()` de Next.js para las siguientes importaciones pesadas en el dashboard:
- `recharts` (todo el bundle de gráficos) → solo se usa en `TendenciaSection`
- `@dnd-kit/core` + `@dnd-kit/sortable` → solo se usa en `dashboard/page.tsx` para DnD de KPIs

**Alternativas consideradas**:
- Migrar a `react-chartjs-2` + Chart.js: cambio de librería innecesario, el problema es el loading timing
- Tree-shaking manual: Recharts tiene el bundle pre-chunkeado, dynamic import es más efectivo

**Justificación**: El dashboard se carga con JS bloqueante de ~150KB+ solo de recharts y dnd-kit. Con `dynamic({ ssr: false })`, estos chunks se cargan post-hydration cuando el componente aparece en viewport.

---

### Decisión 7: Unificación `framer-motion` → `motion/react` (Fase 5)

**Elección**: Eliminar importaciones de `framer-motion` y reemplazarlas por `motion/react` en todos los archivos afectados.

**Alternativas consideradas**:
- Alias de webpack en `next.config.ts` para que `framer-motion` resuelva a `motion/react`: funciona pero oculta el problema
- Mantener ambas: el bundle final incluye dos librerías duplicadas (~60KB extra)

**Justificación**: `motion/react` es la versión oficial renombrada de `framer-motion`. Son API-compatibles. La unificación reduce el bundle sin cambios de comportamiento.

---

### Decisión 8: Eliminar `rootCssVariablesStyle()` del layout (Fase 6)

**Elección**: Eliminar la llamada `<style>{rootCssVariablesStyle()}</style>` del `RootLayout` y conservar únicamente la definición en `globals.css`.

**Alternativas consideradas**:
- Eliminar las variables de `globals.css` y conservar solo el inyector JS: las variables en CSS estático son parseadas en el primer paint, el inyector JS requiere ejecución de JS
- Mantener ambos (status quo): duplicación silenciosa de ~50 variables CSS, el inyector JS tiene precedencia por specificity inline

**Justificación**: `globals.css` ya contiene **todas** las variables de `ROOT_CSS_VARIABLES` (verificado en líneas 154–250 del archivo). La función `rootCssVariablesStyle()` genera un `<style>` inline en `<head>` con `:root { ... }` que duplica exactamente lo que ya provee el CSS estático. Eliminar el inyector JS reduce el HTML de la primera respuesta y elimina un bloqueo de parsing.

**Riesgo**: Si en el futuro se agregan tokens a `color-tokens.ts` sin agregarlos a `globals.css`, la variable faltará. Se recomienda agregar un comentario de advertencia en `color-tokens.ts`.

---

### Decisión 9: Arquitectura híbrida Server/Client para Dashboard (Fase 7)

**Elección**: Crear un Server Component wrapper `DashboardPage` que haga el fetch inicial de KPIs y los pase como props a los Client Components existentes (`KpiCard`, `DndContext`).

**Alternativas consideradas**:
- Convertir todo el dashboard a Server Components: imposible por el DnD (requiere event handlers), los estados de filtro de período y la personalización por drag
- Server Actions para refetch: complementario, no alternativo para la carga inicial
- React Server Components con streaming (Suspense boundaries internas): la opción más óptima a largo plazo pero la más compleja

**Justificación**: La separación mínima viable es: Server Component hace el fetch inicial (aprovechando `unstable_cache`), pasa datos como props al Client Component que maneja DnD y estado de UI. Esto elimina el loading spinner inicial del dashboard y permite que el contenido sea visible en el primer paint del servidor.

---

## Flujo de Datos

### Estado Actual (problema)

```
Browser
  │
  ├── GET /dashboard
  │     └── layout.tsx (Server) → checkAuth() → fetch /api/auth/me → DB
  │
  │   [HTML sin contenido útil → spinner]
  │
  ├── Hydration JS
  │     └── SubscriptionGuard (Client) → fetch /api/subscriptions/current → [SPINNER BLOQUEANTE]
  │           └── Si OK → render children
  │
  └── useDashboard() hook
        └── 3 fetches paralelos: /api/dashboard/kpi + /consignaciones + /top-productos
              └── requireAuth() en cada endpoint → verifyJWT + DB lookup (PER REQUEST)
```

### Estado Objetivo (fases 1-7)

```
Browser
  │
  ├── GET /dashboard
  │     └── layout.tsx (Server)
  │           ├── requireAuth() [con cache() → 1 sola DB query por request]
  │           ├── checkSubscription() [en el mismo Server Component, sin client round-trip]
  │           └── Si ambos OK → render layout
  │
  │   [HTML con skeleton inmediato desde loading.tsx]
  │
  ├── DashboardPage (Server Component - Fase 7)
  │     └── getDashboardKpis() [unstable_cache → TTL 60s → 0 DB queries si warm]
  │           └── Props → DashboardClientShell (Client Component)
  │                 ├── KpiCards (con datos iniciales del server)
  │                 ├── DndContext (lazy loaded)
  │                 └── TendenciaSection (lazy loaded con recharts)
  │
  └── JS Bundle optimizado
        ├── recharts → chunk separado (lazy)
        ├── @dnd-kit → chunk separado (lazy)
        └── motion/react (único, sin duplicado framer-motion)
```

---

## Cambios en Archivos

### Fase 1 — `loading.tsx` + Skeletons

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/app/(system-guard)/(protected)/dashboard/loading.tsx` | Crear | Skeleton de 4 KPI cards + 2 secciones de tabla |
| `src/app/(system-guard)/(protected)/productos/loading.tsx` | Crear | Skeleton de tabla con 8 filas |
| `src/app/(system-guard)/(protected)/consignaciones/loading.tsx` | Crear | Skeleton de tabla con 6 filas |
| `src/app/(system-guard)/(protected)/clientes/loading.tsx` | Crear | Skeleton de tabla con 6 filas |
| `src/app/(system-guard)/(protected)/ventas/loading.tsx` | Crear | Skeleton de tabla con 6 filas |
| `src/app/(system-guard)/(protected)/gastos/loading.tsx` | Crear | Skeleton de tarjetas de KPI + tabla |
| `src/app/(system-guard)/(protected)/caja/abrir/loading.tsx` | Crear | Skeleton de form |
| `src/app/(system-guard)/(protected)/settings/loading.tsx` | Crear | Skeleton de panel de configuración |

### Fase 2 — Caché de Autenticación

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/lib/requireAuth.ts` | Modificar | Envolver con `cache()` de React para deduplicar dentro del mismo request |
| `src/app/(system-guard)/(protected)/layout.tsx` | Modificar | Usar la versión cacheada de `requireAuth()` para deduplicar con los route handlers |

### Fase 3 — SubscriptionGuard sin spinner bloqueante

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/app/(system-guard)/(protected)/layout.tsx` | Modificar | Agregar `checkSubscription()` como Server Component, reemplazando al guard cliente |
| `src/components/SubscriptionGuard.tsx` | Modificar | Convertir en pass-through (`return <>{children}</>`) para no romper imports existentes, o eliminarlo si no hay otros consumidores |

### Fase 4 — Caché de KPIs con `unstable_cache`

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/lib/kpi-logic.ts` | Modificar | Envolver `getDashboardKpis()` con `unstable_cache`, key `['dashboard', 'kpis', sucursalId, period]`, revalidate 60s |
| `src/app/api/dashboard/kpi/route.ts` | Modificar | Agregar `revalidateTag('dashboard')` en mutaciones de ventas/pagos si existen webhooks o endpoints de escritura |

### Fase 5 — Images + Bundle

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `next.config.ts` | Modificar | Agregar dominio de producción a `remotePatterns`, habilitar `formats: ['image/avif', 'image/webp']` |
| `src/app/(system-guard)/(protected)/productos/components/productos-view.tsx` | Modificar | Reemplazar `<img>` por `<Image>` de `next/image` |
| `src/app/(system-guard)/(protected)/settings/branding/page.tsx` | Modificar | Reemplazar `<img>` por `<Image>` de `next/image` |
| `src/app/(system-guard)/(protected)/ventas/nueva/components/cart-item-card.tsx` | Modificar | Reemplazar `<img>` por `<Image>` de `next/image` |
| `src/app/(system-guard)/(protected)/ventas/nueva/components/product-selector.tsx` | Modificar | Reemplazar `<img>` por `<Image>` de `next/image` |
| `src/app/lista/components/cart-drawer.tsx` | Modificar | Reemplazar `<img>` por `<Image>` de `next/image` |
| `src/app/lista/components/store-footer.tsx` | Modificar | Reemplazar `<img>` por `<Image>` de `next/image` |
| `src/app/(system-guard)/(protected)/dashboard/components/tendencia-section.tsx` | Modificar | Usar `dynamic()` para recharts |
| `src/app/(system-guard)/(protected)/dashboard/page.tsx` | Modificar | Usar `dynamic()` para `@dnd-kit/core` y `@dnd-kit/sortable` |
| Todos los archivos con `framer-motion` (ver lista abajo) | Modificar | Reemplazar `from "framer-motion"` por `from "motion/react"` |

**Archivos con `framer-motion` a migrar:**
- `src/app/(system-guard)/(protected)/clientes/components/clientes-view.tsx`
- `src/app/(system-guard)/(protected)/clientes/[id]/page.tsx`
- `src/app/(system-guard)/(protected)/consignaciones/nueva/page.tsx`
- `src/app/(system-guard)/(protected)/consignaciones/page.tsx`
- `src/app/(system-guard)/(protected)/dashboard/components/dashboard-header.tsx`
- `src/app/(system-guard)/(protected)/dashboard/components/kpi-card.tsx`
- `src/app/(system-guard)/(protected)/dashboard/components/operations-section.tsx`
- `src/app/(system-guard)/(protected)/dashboard/components/top-products-section.tsx`
- `src/app/(system-guard)/(protected)/pedidos-esperados/components/pedidos-esperados-view.tsx`
- `src/app/(system-guard)/(protected)/productos/components/productos-view.tsx`
- `src/app/(system-guard)/(protected)/settings/subscriptions/components/*.tsx` (4 archivos)
- `src/app/(system-guard)/(protected)/ventas/nueva/components/cart-list.tsx`
- `src/app/lista/components/cart-drawer.tsx`
- `src/app/lista/components/product-card.tsx`
- `src/app/lista/components/product-modal.tsx`

### Fase 6 — CSS Cleanup

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/app/layout.tsx` | Modificar | Eliminar `import { rootCssVariablesStyle }` y `<style>{rootCssVariablesStyle()}</style>` |
| `src/lib/theme/color-tokens.ts` | Modificar | Agregar comentario JSDoc advirtiendo que las variables también deben actualizarse en `globals.css` |

### Fase 7 — Dashboard Híbrido

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/app/(system-guard)/(protected)/dashboard/page.tsx` | Modificar | Convertir en Server Component que pre-fetcha KPIs y los pasa a `DashboardClientShell` |
| `src/app/(system-guard)/(protected)/dashboard/components/dashboard-client-shell.tsx` | Crear | Client Component que recibe `initialKpis` como prop y maneja DnD + estado de período |
| `src/app/(system-guard)/(protected)/dashboard/hooks/use-dashboard.ts` | Modificar | Aceptar `initialData` opcional para hidratar el estado sin fetch inmediato |

---

## Interfaces / Contratos

### Fase 2 — `requireAuth()` cacheada

```typescript
// src/lib/requireAuth.ts
import { cache } from "react";

// La función existente se renombra a _requireAuthImpl (privada)
async function _requireAuthImpl() {
  // ... implementación actual sin cambios ...
}

// Se exporta la versión cacheada (deduplicada por request)
export const requireAuth = cache(_requireAuthImpl);
```

> **Nota**: `cache()` de React crea un scope por request en Next.js. Dos llamadas a `requireAuth()` en el mismo render tree retornan la misma Promise.

---

### Fase 3 — Verificación de suscripción en layout

```typescript
// src/app/(system-guard)/(protected)/layout.tsx (adición)
async function checkSubscription(origin: string, cookieHeader: string): Promise<boolean> {
  try {
    const res = await fetch(`${origin}/api/subscriptions/current`, {
      cache: "no-store",
      headers: { cookie: cookieHeader },
    });
    if (!res.ok) return true; // fail-open: no bloqueamos si el endpoint falla
    const data = await res.json();
    return data.hasSubscription ?? true;
  } catch {
    return true; // fail-open
  }
}

// En ProtectedLayout, después de checkAuth():
const hasSub = await checkSubscription(origin, cookieHeader);
if (!hasSub) redirect("/settings/subscriptions");
```

---

### Fase 4 — `getDashboardKpis()` con caché

```typescript
// src/lib/kpi-logic.ts (modificación)
import { unstable_cache } from "next/cache";

export const getDashboardKpis = unstable_cache(
  async (sucursalId: number, period: DashboardPeriod, isAdmin: boolean = false) => {
    // ... implementación actual sin cambios ...
  },
  ["dashboard-kpis"], // cache key base
  {
    revalidate: 60,
    tags: ["dashboard", "kpis"],
  }
);
// ⚠️ La cache key real es: ["dashboard-kpis", sucursalId, period, isAdmin]
// Next.js serializa los argumentos automáticamente como parte de la key
```

---

### Fase 7 — Dashboard híbrido

```typescript
// src/app/(system-guard)/(protected)/dashboard/page.tsx
// (Server Component — sin "use client")
import { getDashboardKpis } from "@/lib/kpi-logic";
import { requireAuth } from "@/lib/requireAuth";
import { DashboardClientShell } from "./components/dashboard-client-shell";

export default async function DashboardPage() {
  const auth = await requireAuth(); // cacheada, sin costo extra
  if (!auth.ok) redirect("/login");

  const initialKpis = await getDashboardKpis(
    auth.activeSucursalId,
    "month",
    auth.user.rol === "ADMIN"
  ); // cacheado 60s

  return <DashboardClientShell initialKpis={initialKpis} />;
}
```

```typescript
// src/app/(system-guard)/(protected)/dashboard/components/dashboard-client-shell.tsx
"use client";

import type { DashboardKpis, DashboardPeriod } from "@/lib/types";
// ... imports existentes del dashboard/page.tsx ...

interface Props {
  initialKpis: DashboardKpis;
}

export function DashboardClientShell({ initialKpis }: Props) {
  // Estado local para período y DnD
  // El hook useDashboard recibe initialKpis y evita el primer fetch
  const { kpis, loading, error, refresh } = useDashboard("month", initialKpis);
  // ... render igual que el dashboard actual ...
}
```

---

### Fase 1 — Patrón de Skeleton

```typescript
// Patrón reutilizable para todos los loading.tsx
// Ejemplo: src/app/(system-guard)/(protected)/dashboard/loading.tsx
export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="h-8 w-48 rounded-lg bg-muted" />
      
      {/* KPI Cards skeleton — 4 cards en grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-muted" />
        ))}
      </div>

      {/* Tabla skeleton */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="h-10 bg-muted/50 border-b border-border" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 border-b border-border/50 bg-muted/20" />
        ))}
      </div>
    </div>
  );
}
```

---

## Estrategia de Pruebas

| Capa | Qué Probar | Enfoque |
|------|------------|---------|
| Manual/Visual | Que los skeletons aparecen durante la navegación entre rutas | Navegar entre rutas en modo development con throttling de red (Chrome DevTools → Slow 3G) |
| Manual/Visual | Que no hay FOUC (Flash of Unstyled Content) después de eliminar `rootCssVariablesStyle()` | Verificar light/dark mode y todos los componentes que usan variables custom |
| Manual/Visual | Que el dashboard muestra contenido sin spinner bloqueante | Cargar `/dashboard` en una sesión autenticada y medir tiempo hasta primer contenido visible |
| Funcional | Que `requireAuth()` cacheada retorna el mismo resultado en múltiples llamadas | Unit test con mock de Prisma verificando que `prisma.userSession.findUnique` se llama 1 sola vez por request |
| Funcional | Que la suscripción inválida redirige desde el server | Test de integración: request con cookie de sesión válida pero suscripción inactiva → verificar redirect 307 a `/settings/subscriptions` |
| Funcional | Que los KPIs cacheados son correctos | Verificar que dos requests consecutivos al mismo endpoint con mismos params retornan idénticos datos y que la DB no es consultada en el segundo |
| Funcional | Que `next/image` no rompe las imágenes existentes | Review visual de productos, branding y carrito tras la migración |
| Bundle | Que recharts y dnd-kit están en chunks separados | `next build` + analizar `.next/analyze/` con `@next/bundle-analyzer` |

---

## Migración / Despliegue

### Orden recomendado de despliegue

```
Fase 6 (CSS cleanup)      → Menor riesgo, cero funcionalidad afectada
    ↓
Fase 1 (loading.tsx)      → Cero riesgo, pura adición
    ↓
Fase 5 (images + bundle)  → Riesgo bajo, verificar remotePatterns antes de producción
    ↓
Fase 2 (auth cache)       → Riesgo medio, requiere test en staging
    ↓
Fase 3 (subscription SC)  → Riesgo medio-alto, cambio de comportamiento de autenticación
    ↓
Fase 4 (KPI cache)        → Riesgo bajo, datos analíticos toleran 60s de stale
    ↓
Fase 7 (dashboard híbrido) → Riesgo alto, refactor mayor, requiere staging completo
```

### Consideraciones de rollback

- **Fases 1, 5, 6**: Rollback trivial (revertir archivos)
- **Fase 2**: Si `cache()` causa comportamiento inesperado (por algún edge case con `next/headers`), revertir a la implementación sin cache
- **Fase 3**: Mantener `SubscriptionGuard` como pass-through (no eliminar el componente) para evitar errores de importación
- **Fase 4**: `unstable_cache` puede deshabilitarse cambiando `revalidate: 60` a `revalidate: 0`
- **Fase 7**: El Server Component wrapper puede revertirse restaurando `"use client"` en `page.tsx`

### Variables de entorno a verificar

```bash
# Necesario para que apiService.ts resuelva URLs en SSR
NEXT_PUBLIC_APP_URL=https://tudominio.com

# Necesario para next.config.ts remotePatterns en producción
# (agregar hostname del CDN si aplica)
```

---

## Dependencias entre Fases

```
Fase 1 (loading.tsx)
  └── Independiente ✅

Fase 2 (auth cache)
  └── Independiente ✅ (pero es prerequisito conceptual de Fase 7)

Fase 3 (subscription en SC)
  └── Requiere: Fase 2 aplicada (para no pagar 2 DB queries de auth)
  └── Si se aplica sin Fase 2: funciona pero el layout hace 2 queries separadas

Fase 4 (KPI cache)
  └── Independiente ✅ (pero el beneficio completo se ve en Fase 7)

Fase 5 (images + bundle)
  └── Independiente ✅

Fase 6 (CSS cleanup)
  └── Independiente ✅

Fase 7 (dashboard híbrido)
  └── Requiere: Fase 2 (auth cacheada) + Fase 4 (KPI cacheado)
  └── Se recomienda: Fase 1 (loading.tsx) ya aplicada
```

---

## Preguntas Abiertas

- [ ] **Dominio de producción para imágenes**: ¿Las imágenes de productos se sirven desde el mismo servidor (`/api/files/**`) o desde un CDN externo (Cloudinary, S3, etc.)? Determina qué `remotePatterns` agregar en `next.config.ts`.
- [ ] **Frecuencia de invalidación de KPI cache**: ¿Las operaciones de venta/pago deben invalidar el cache inmediatamente vía `revalidateTag('dashboard')`? Si sí, hay que agregar la llamada en los route handlers POST de ventas y pagos.
- [ ] **`SubscriptionGuard` en otras rutas**: ¿El componente `SubscriptionGuard` se usa en algún lugar fuera del `layout.tsx` de protected? Si sí, eliminar en lugar de convertir en pass-through puede romper imports.
- [ ] **Ruta `/api/subscriptions/current`**: ¿Este endpoint usa `requireAuth()` internamente? Si sí, la Fase 2 ya lo beneficia sin cambios adicionales.
- [ ] **Dashboard Híbrido y `activeSucursalId`**: En la Fase 7, el Server Component necesita el `activeSucursalId`. Actualmente este viene del store Zustand (client-side). ¿Se envía como header `x-sucursal-id`? Confirmar que el layout ya lo propaga para que `requireAuth()` lo resuelva correctamente.
