# Tareas: Optimización de Performance

**Cambio**: `optimizacion-performance`
**Fecha**: 2026-03-13
**Estado**: ✅ Implementado — verificado y archivado el 2026-03-13
**Basado en**: `design.md` + auditoría de código real del proyecto

---

## Dependencias entre Fases

```
Fase 6 (CSS Cleanup)      → sin deps → ejecutar primero (riesgo cero)
Fase 1 (loading.tsx)      → sin deps → ejecutar segundo (riesgo cero)
Fase 5 (Bundle/Images)    → sin deps → paralelo con Fase 2-4
Fase 2 (Auth Cache)       → sin deps → prerequisito conceptual de Fase 7
Fase 4 (KPI Cache)        → sin deps → prerequisito de Fase 7
Fase 3 (SubscriptionGuard)→ recomendado: después de Fase 2
Fase 7 (Dashboard Híbrido)→ requiere: Fase 2 + Fase 4 + Fase 1 completadas
```

---

## FASE 1 — Quick Wins UX: `loading.tsx` + Skeletons

> **Riesgo**: 🟢 Nulo — solo archivos nuevos, no modifica nada existente.
> **Impacto**: Elimina el 100% de pantallas en blanco durante la navegación.
> **Tiempo estimado**: 2–3h total.

### Criterios de verificación

- [ ] Cada ruta protegida muestra un skeleton durante la navegación (verificar con DevTools → Network → Slow 3G)
- [ ] Los skeletons NO producen errores de hidratación en la consola
- [ ] `next build` pasa sin errores después de esta fase

### Rollback

Eliminar los archivos `loading.tsx` creados. Cero impacto funcional.

---

- [ ] **1.1** Crear `src/app/(system-guard)/(protected)/dashboard/loading.tsx`
  - Skeleton: 1 header bar (h-8 w-48) + grid de **4 KPI cards** (`grid-cols-4 gap-4`, cada card `h-32`) + 2 secciones de tabla (`h-10` header + 5 filas `h-14`). Clase `animate-pulse`.
  - _Referencia patrón_: ver `design.md` sección "Fase 1 — Patrón de Skeleton"

- [ ] **1.2** Crear `src/app/(system-guard)/(protected)/productos/loading.tsx`
  - Skeleton: 1 header con botón de acción + barra de búsqueda/filtros (`h-10 w-full`) + tabla con **8 filas** (`h-14` c/u) + paginación (`h-10`).

- [ ] **1.3** Crear `src/app/(system-guard)/(protected)/consignaciones/loading.tsx`
  - Skeleton: header + filtros de estado (pills `h-8 rounded-full`) + tabla con **6 filas** + columnas de estado con badge.

- [ ] **1.4** Crear `src/app/(system-guard)/(protected)/clientes/loading.tsx`
  - Skeleton: header + barra búsqueda + tabla con **6 filas** con avatar circular (`h-10 w-10 rounded-full`) + nombre + email.

- [ ] **1.5** Crear `src/app/(system-guard)/(protected)/ventas/loading.tsx`
  > **Nota**: No existe `ventas/page.tsx` como listado. Hay `ventas/[id]/page.tsx` y `ventas/nueva/page.tsx`. Crear el `loading.tsx` en el directorio padre `ventas/` para que aplique a las subrutas dinámicas.
  - Skeleton: layout de dos columnas (lista izquierda `w-2/3` + panel derecho `w-1/3`) con items tipo cart.

- [ ] **1.6** Crear `src/app/(system-guard)/(protected)/gastos/loading.tsx`
  - Skeleton: 3 tarjetas de resumen KPI en fila (`h-24 rounded-xl`) + tabla de gastos con **6 filas**.

- [ ] **1.7** Crear `src/app/(system-guard)/(protected)/pedidos-esperados/loading.tsx`
  - Skeleton: header + filtros de estado + tabla con **6 filas** con badge de estado y fecha.

- [ ] **1.8** Crear `src/app/(system-guard)/(protected)/liquidaciones/loading.tsx`
  - Skeleton: header + tabla con **6 filas** con columnas: consignación, monto, estado, fecha.

- [ ] **1.9** Crear `src/app/(system-guard)/(protected)/caja/loading.tsx`
  - Skeleton: card central grande (`h-48 max-w-md mx-auto`) simulando panel de apertura de caja + 2 botones acción.

- [ ] **1.10** Crear `src/app/(system-guard)/(protected)/settings/loading.tsx`
  - Skeleton: panel de navegación lateral (`w-64 h-full`) + área de contenido con 3 secciones separadas por `<hr>`.

- [ ] **1.11** Crear `src/app/(system-guard)/(protected)/settings/subscriptions/loading.tsx`
  - Skeleton: card de estado de suscripción actual (`h-32`) + 3 tarjetas de plan (`h-64`) en grid.

- [ ] **1.12** Crear `src/app/(system-guard)/(protected)/settings/branding/loading.tsx`
  - Skeleton: formulario de configuración con `h-10` inputs alternados + preview de logo (`h-32 w-32 rounded-full`).

- [ ] **1.13** Crear `src/app/(system-guard)/(protected)/settings/tienda/loading.tsx`
  - Skeleton: tabs navegación horizontal + área de contenido con formulario.

- [ ] **1.14** Crear `src/app/(system-guard)/(protected)/settings/whatsapp/loading.tsx`
  - Skeleton: panel de configuración + preview de chat simulado (`h-48`).

- [ ] **1.15** Crear `src/app/(system-guard)/(protected)/settings/branches/loading.tsx`
  - Skeleton: lista de sucursales con 3 cards (`h-24 rounded-xl`).

- [ ] **1.16** Crear `src/app/(system-guard)/(protected)/settings/security/loading.tsx`
  - Skeleton: secciones de seguridad con headers y listas de items.

- [ ] **1.17** Crear `src/app/(system-guard)/(protected)/settings/pos/loading.tsx`
  - Skeleton: formulario de configuración del POS con switches y selects.

- [ ] **1.18** Crear `src/app/(system-guard)/(protected)/settings/notifications/loading.tsx`
  - Skeleton: lista de toggle switches con labels (`h-12` por item, 5 items).

---

## FASE 2 — Caché de Autenticación con `React.cache()`

> **Riesgo**: 🟡 Medio — cambia el comportamiento de deduplicación de auth. Requiere test en staging.
> **Impacto**: Elimina N queries a `userSession` por request. La Fase 3 y Fase 7 dependen de esto.
> **Tiempo estimado**: 1–2h.

### Contexto de implementación

Actualmente `requireAuth()` en `src/lib/requireAuth.ts` (línea 10) ejecuta:
1. `getAuthTokenFromCookies()` → lee cookie de JWT
2. `verifyUserJwt(token)` → decodifica el JWT
3. `prisma.userSession.findUnique()` → query a la DB por cada llamada

Con `cache()` de React, múltiples invocaciones en el mismo render tree reusarán el resultado de la primera llamada.

### Criterios de verificación

- [ ] Logs de Prisma muestran exactamente **1** query a `userSession` por request (incluso si `requireAuth()` se llama desde layout + route handler)
- [ ] Comportamiento de redirect a `/login` se mantiene idéntico cuando la sesión es inválida
- [ ] No hay errores de tipo TypeScript después del cambio
- [ ] `next build` pasa sin errores

### Rollback

Remover el wrapper `cache()` en `requireAuth.ts`. La función vuelve a ser la implementación directa sin cache.

---

- [ ] **2.1** Modificar `src/lib/requireAuth.ts`:
  - Agregar `import { cache } from "react"` al inicio del archivo
  - Renombrar la función actual `requireAuth` a `_requireAuthImpl` (mantener la firma idéntica)
  - Exportar `export const requireAuth = cache(_requireAuthImpl)`
  - Verificar que `requireRole` (línea 88) no requiere cambios (es función síncrona, no aplica cache)

- [ ] **2.2** Verificar que el `layout.tsx` de `(protected)` usa `requireAuth()` directamente:
  - Actualmente usa `checkAuth()` (función local que hace `fetch /api/auth/me`) — **esta es la duplicación actual**
  - Modificar `src/app/(system-guard)/(protected)/layout.tsx`: reemplazar la función `checkAuth()` y su fetch por una llamada a `requireAuth()` importado de `@/lib/requireAuth`
  - Asegurarse de que si `!auth.ok` → `redirect("/login")`
  - Preservar la lógica de `triggerCheckVencidos()` (fire-and-forget, no afectada)

- [ ] **2.3** Auditoria de otros consumidores de `requireAuth()`:
  - Ejecutar `grep -r "requireAuth" ./src/app/api --include="*.ts" | head -20` para listar route handlers que la usan
  - Confirmar que los route handlers (que son requests separados) también se benefician del cache por-request
  - Documentar los 5 principales route handlers que llaman `requireAuth()` como referencia

---

## FASE 3 — SubscriptionGuard sin Spinner Bloqueante

> **Riesgo**: 🟠 Medio-Alto — cambia cuándo y cómo se verifica la suscripción. Puede haber flash de contenido si algo falla.
> **Impacto**: Elimina el spinner de pantalla completa en TODAS las navegaciones internas.
> **Dependencia**: Se recomienda **después de Fase 2** (para no pagar 2 DB queries de auth en el layout).
> **Tiempo estimado**: 2–3h.

### Contexto de implementación

`SubscriptionGuard` (`src/components/SubscriptionGuard.tsx`) actualmente:
- Es un Client Component (`"use client"`)
- Hace `fetch("/api/subscriptions/current")` en cada montaje y cambio de `pathname`
- Muestra `<Loader2 className="animate-spin">` bloqueando toda la pantalla mientras carga
- Es consumido **únicamente** en `src/app/(system-guard)/(protected)/layout.tsx` (verificado)

### Criterios de verificación

- [ ] Navegar entre rutas protegidas NO muestra el spinner de "Verificando acceso..."
- [ ] Un usuario sin suscripción activa es redirigido a `/settings/subscriptions` DESDE EL SERVIDOR (verificar en Network tab: debe ser redirect 307, no una navegación client-side)
- [ ] Usuario con suscripción activa navega normalmente sin bloqueo
- [ ] La ruta `/settings/subscriptions` es accesible aunque no haya suscripción
- [ ] `next build` pasa sin errores

### Rollback

Revertir `layout.tsx` al estado anterior (con `<SubscriptionGuard>`). Mantener el componente como pass-through en lugar de eliminarlo garantiza que no haya errores de import.

---

- [ ] **3.1** Agregar función `checkSubscription()` en `src/app/(system-guard)/(protected)/layout.tsx`:
  ```typescript
  async function checkSubscription(origin: string, cookieHeader: string): Promise<boolean> {
    if (!origin) return true; // fail-open si no hay origin
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
  ```

- [ ] **3.2** Modificar `ProtectedLayout` en `layout.tsx` para llamar `checkSubscription()` después de `requireAuth()`:
  - Llamar `const hasSub = await checkSubscription(origin, cookieHeader)` SOLO si `auth.ok === true`
  - Si `!hasSub && pathname !== "/settings/subscriptions"` → `redirect("/settings/subscriptions")`
  - Importar `headers` de `next/headers` para obtener `pathname` actual (o usar `headers().get("x-invoke-path")`)
  - **Importante**: La verificación de suscripción en `/settings/subscriptions` debe ser `if (!hasSub && !currentPath.startsWith("/settings/subscriptions"))` para no crear loop infinito

- [ ] **3.3** Convertir `SubscriptionGuard` en pass-through en `src/components/SubscriptionGuard.tsx`:
  - Reemplazar toda la lógica por: `export function SubscriptionGuard({ children }: { children: React.ReactNode }) { return <>{children}</>; }`
  - Mantener el archivo (no eliminar) para no romper el import en `layout.tsx`
  - Mantener el `"use client"` directive para no cambiar el boundary

- [ ] **3.4** Verificar comportamiento con sesión válida + suscripción inactiva:
  - Usar una cuenta de test con suscripción vencida
  - Confirmar redirect server-side a `/settings/subscriptions`
  - Confirmar que `/settings/subscriptions` carga sin redirect loop

---

## FASE 4 — Caché de Datos del Dashboard con `unstable_cache`

> **Riesgo**: 🟢 Bajo — los KPIs son datos analíticos, 60s de stale es aceptable para un POS activo.
> **Impacto**: Reduce de 14+ queries a 0 queries si el cache está warm. El beneficio completo se ve en Fase 7.
> **Dependencia**: Independiente. Prerequisito de Fase 7.
> **Tiempo estimado**: 1–2h.

### Contexto de implementación

`getDashboardKpis()` en `src/lib/kpi-logic.ts` (línea 10) es actualmente una función async sin caché que ejecuta múltiples queries Prisma por cada llamada. La función acepta `(sucursalId: number, period: DashboardPeriod, isAdmin: boolean)`.

`apiService.ts` (línea 81) tiene `cache: init?.cache || "no-store"` como default global, que impide cualquier caché de fetch en el cliente.

### Criterios de verificación

- [ ] Dos requests consecutivos al endpoint `/api/dashboard/kpi` con los mismos parámetros NO generan queries a Prisma en el segundo request (verificar con `DEBUG=prisma:query`)
- [ ] El cache se invalida correctamente después de 60 segundos
- [ ] Tags `['dashboard', 'kpis']` están presentes (verificable con `revalidateTag` manual en dev)
- [ ] Los KPIs retornados son numéricamente correctos (no hay mezcla entre sucursales)
- [ ] `next build` pasa sin errores

### Rollback

Eliminar el wrapper `unstable_cache`. La función vuelve a ser async directa. Revertir el default de `apiService.ts`.

---

- [ ] **4.1** Modificar `src/lib/kpi-logic.ts`:
  - Agregar `import { unstable_cache } from "next/cache"` al inicio
  - Identificar la firma exacta de `getDashboardKpis` (línea 10) y su bloque de implementación
  - Envolver con `unstable_cache`:
    ```typescript
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
    ```
  - ⚠️ Verificar que la firma exportada mantiene la misma forma que consume el route handler `/api/dashboard/kpi/route.ts`

- [ ] **4.2** Agregar `revalidateTag` en el route handler de ventas (si existe endpoint de creación de venta):
  - Identificar: `grep -r "revalidateTag\|POST.*ventas\|createVenta" ./src/app/api --include="*.ts" -l`
  - Si existe endpoint `POST /api/ventas`, agregar al final: `revalidateTag("dashboard")` y `revalidateTag("kpis")`
  - Si existe endpoint `POST /api/pagos` o similar, ídem

- [ ] **4.3** Modificar `src/lib/apiService.ts` línea 81:
  - Cambiar el default `cache: init?.cache || "no-store"` a `cache: init?.cache || "default"`
  - Esto permite que los endpoints que no especifican cache explícito usen el comportamiento estándar del browser/Next.js
  - **⚠️ Revisar**: identificar qué endpoints actualmente dependen del `no-store` para no cachear datos sensibles (auth, suscripciones) y agregar `cache: "no-store"` explícito en esos fetch específicos

- [ ] **4.4** Auditoría de endpoints sensibles que necesitan `cache: "no-store"` explícito post-cambio:
  - `/api/auth/me` → siempre `no-store`
  - `/api/subscriptions/current` → siempre `no-store`
  - `/api/caja/estado` → siempre `no-store`
  - Agregar `cache: "no-store"` explícito en los fetch de estos endpoints en el código cliente

---

## FASE 5 — Bundle Optimization: Images + Dynamic Imports + motion/react

> **Riesgo**: 🟡 Medio — migración de `<img>` puede romper imágenes si `remotePatterns` no cubre todos los dominios.
> **Impacto**: Reduce bundle inicial ~30%+. Imágenes con WebP automático y lazy loading.
> **Dependencia**: Independiente.
> **Tiempo estimado**: 4–6h total (subdividido en sub-tareas).

### Criterios de verificación

- [ ] `next build` pasa sin errores ni warnings de imagen
- [ ] Las imágenes de productos, logo de branding y items del carrito se muestran correctamente en todas las páginas
- [ ] `webpack-bundle-analyzer` muestra recharts y @dnd-kit en chunks separados (no en el bundle inicial)
- [ ] Solo una librería de animación aparece en el bundle (`motion/react`, no `framer-motion`)
- [ ] No hay errores de consola de tipo "hostname not configured" en `next/image`

### Rollback

- `framer-motion`: restaurar imports originales en los archivos modificados
- `next/image`: revertir `<Image>` a `<img>` nativo
- `dynamic()`: revertir a imports directos

---

### 5A — Unificación `framer-motion` → `motion/react`

- [ ] **5.1** Verificar qué archivos usan `"motion/react"` vs `"framer-motion"` (ya auditado: todos los listados abajo usan `framer-motion`):
  - Ejecutar: `grep -rn "from \"framer-motion\"\|from 'framer-motion'" ./src --include="*.tsx" --include="*.ts" | wc -l` para contar el total

- [ ] **5.2** Reemplazar `from "framer-motion"` → `from "motion/react"` en los siguientes archivos **(confirmados con `framer-motion`)**:
  - `src/app/(system-guard)/(protected)/clientes/[id]/page.tsx`
  - `src/app/(system-guard)/(protected)/consignaciones/nueva/page.tsx`
  - `src/app/(system-guard)/(protected)/consignaciones/page.tsx`
  - `src/app/(system-guard)/(protected)/dashboard/components/dashboard-header.tsx`
  - `src/app/(system-guard)/(protected)/dashboard/components/kpi-card.tsx`
  - `src/app/(system-guard)/(protected)/dashboard/components/operations-section.tsx`
  - `src/app/(system-guard)/(protected)/dashboard/components/top-products-section.tsx`
  - `src/app/(system-guard)/(protected)/pedidos-esperados/components/pedidos-esperados-view.tsx`
  - `src/app/(system-guard)/(protected)/productos/components/productos-view.tsx`
  - `src/app/(system-guard)/(protected)/settings/subscriptions/components/CancelSubscriptionModal.tsx`
  - `src/app/(system-guard)/(protected)/settings/subscriptions/components/DowngradeModal.tsx`
  - `src/app/(system-guard)/(protected)/settings/subscriptions/components/PaymentProcess.tsx`
  - `src/app/(system-guard)/(protected)/settings/subscriptions/components/PricingTable.tsx`
  - `src/app/(system-guard)/(protected)/settings/subscriptions/components/SubscriptionStatusCard.tsx`
  - `src/app/(system-guard)/(protected)/settings/subscriptions/page.tsx`
  - `src/app/(system-guard)/(protected)/ventas/nueva/components/cart-list.tsx`
  - `src/app/lista/components/cart-drawer.tsx`
  - `src/app/lista/components/product-card.tsx`
  - `src/app/lista/components/product-modal.tsx`

- [ ] **5.3** Verificar archivos de `src/components/ui/` que usan `motion/react` vs `framer-motion`:
  - Ejecutar: `grep -rn "from \"framer-motion\"\|from 'framer-motion'" ./src/components/ui/ --include="*.tsx"`
  - Los archivos en `animated-list.tsx`, `blur-fade.tsx`, `dock.tsx`, `globe.tsx`, `highlighter.tsx`, `magic-card.tsx`, `number-ticker.tsx`, `sparkles-text.tsx`, `text-reveal.tsx` deben ser auditados y migrados si usan `framer-motion`

- [ ] **5.4** Verificar que `framer-motion` puede ser removido del `package.json`:
  - Ejecutar: `grep -rn "from \"framer-motion\"" ./src --include="*.tsx" --include="*.ts" | wc -l` — debe ser 0
  - Si es 0: ejecutar `npm uninstall framer-motion`
  - Si quedan referencias: documentarlas y completar la migración antes de desinstalar

### 5B — `next/dynamic` para librerías pesadas

- [ ] **5.5** Modificar `src/app/(system-guard)/(protected)/dashboard/components/tendencia-section.tsx`:
  - Identificar el import directo de recharts (ej: `import { LineChart, Line, ... } from "recharts"`)
  - Convertir el componente completo a importación dinámica desde el archivo padre o usar `React.lazy`
  - Alternativa preferida: en `dashboard/page.tsx` (o `dashboard-client-shell.tsx` en Fase 7), importar `TendenciaSection` con:
    ```typescript
    const TendenciaSection = dynamic(
      () => import("./components/tendencia-section"),
      { ssr: false, loading: () => <div className="h-64 rounded-xl bg-muted animate-pulse" /> }
    );
    ```

- [ ] **5.6** Modificar `src/app/(system-guard)/(protected)/dashboard/page.tsx`:
  - Identificar los imports de `@dnd-kit/core` y `@dnd-kit/sortable`
  - Crear un componente wrapper `DashboardDndShell` que encapsule el DnD context
  - Importar con `dynamic()`:
    ```typescript
    const DashboardDndShell = dynamic(
      () => import("./components/dashboard-dnd-shell"),
      { ssr: false, loading: () => <div className="h-96 animate-pulse bg-muted rounded-xl" /> }
    );
    ```

- [ ] **5.7** Evaluar otros candidatos a `dynamic()` — si existen en el proyecto:
  - SDKs de pago (MercadoPago JS, etc.): `grep -r "mercadopago\|stripe\|paypal" ./src --include="*.tsx" -l`
  - Componente Globe (`src/components/ui/globe.tsx`): verificar si se usa en alguna página principal y si tiene peso significativo
  - Agregar `dynamic()` para los que se confirmen como pesados en páginas principales

### 5C — Migración `<img>` → `next/image`

- [ ] **5.8** Verificar y actualizar `next.config.ts` — agregar configuración de imágenes:
  - Revisar la configuración actual de `remotePatterns`
  - Agregar `formats: ['image/avif', 'image/webp']` si no existe
  - Confirmar que `localhost/api/files/**` está en `remotePatterns`
  - Agregar el dominio de producción si está definido en variables de entorno

- [ ] **5.9** Migrar `src/app/(system-guard)/(protected)/productos/components/productos-view.tsx`:
  - Identificar los `<img src={...}>` de imágenes de productos
  - Reemplazar por `<Image src={...} alt={...} width={...} height={...} />` de `next/image`
  - Para imágenes con dimensiones desconocidas: usar `fill` prop + `object-fit: cover` en el contenedor

- [ ] **5.10** Migrar `src/app/(system-guard)/(protected)/settings/branding/page.tsx`:
  - Identificar `<img>` de logo/branding
  - Reemplazar por `<Image>` con dimensiones apropiadas para el contexto de preview

- [ ] **5.11** Migrar `src/app/lista/components/cart-drawer.tsx`:
  - Identificar `<img>` de productos en el carrito
  - Reemplazar por `<Image>` con dimensiones fijas (ej: `width={64} height={64}`)

- [ ] **5.12** Migrar `src/app/lista/components/store-footer.tsx`:
  - Identificar `<img>` (probablemente logo de la tienda)
  - Reemplazar por `<Image>` con dimensiones apropiadas

- [ ] **5.13** Verificar `src/app/(system-guard)/(protected)/ventas/nueva/components/cart-item-card.tsx` y `product-selector.tsx`:
  > **Nota**: El `design.md` los menciona pero el grep de `<img>` no los encontró. Verificar si usan CSS backgrounds o el `<Image>` de next/image ya.
  - Ejecutar: `grep -n "<img\|next/image" ./src/app/(system-guard)/(protected)/ventas/nueva/components/cart-item-card.tsx`
  - Si tienen `<img>`: migrar. Si no: marcar como verificado y saltar.

---

## FASE 6 — CSS Variables Cleanup

> **Riesgo**: 🟢 Nulo — solo elimina redundancia. La fuente de verdad (`globals.css`) no cambia.
> **Impacto**: Reduce el HTML de la primera respuesta. Elimina un bloqueo de parsing de JS.
> **Dependencia**: Independiente. Ejecutar primero (es el cambio más seguro).
> **Tiempo estimado**: 30min–1h.

### Criterios de verificación

- [ ] Light mode y dark mode se ven idénticos antes y después del cambio (snapshot visual)
- [ ] Ningún componente muestra colores faltantes o variables CSS undefined (inspeccionar con DevTools)
- [ ] `next build` pasa sin errores
- [ ] El HTML del `<head>` ya NO contiene el bloque `<style>:root { --color-... }</style>` inline

### Rollback

Restaurar el `import` y la llamada `<style>{rootCssVariablesStyle()}</style>` en `src/app/layout.tsx`.

---

- [ ] **6.1** Tomar snapshot visual antes del cambio:
  - Capturar screenshots de: dashboard, productos, clientes, y settings en light mode y dark mode
  - Guardar como referencia de comparación post-cambio

- [ ] **6.2** Modificar `src/app/layout.tsx`:
  - Eliminar la línea: `import { rootCssVariablesStyle } from "@/lib/theme/color-tokens";`
  - Eliminar la línea: `<style>{rootCssVariablesStyle()}</style>` del JSX del `<head>`
  - No modificar nada más en el archivo

- [ ] **6.3** Modificar `src/lib/theme/color-tokens.ts`:
  - Agregar un comentario JSDoc en la función `rootCssVariablesStyle()` (o en el export del objeto de tokens):
    ```typescript
    /**
     * ⚠️ IMPORTANTE: Las variables CSS generadas por este archivo también deben
     * existir en `src/app/globals.css` bajo `:root { }`.
     * globals.css es la fuente de verdad para el CSS estático.
     * Si agregás un token aquí, agregalo también en globals.css.
     *
     * @deprecated rootCssVariablesStyle() ya no se inyecta en el layout.
     * Mantener solo para referencia de tokens.
     */
    ```
  - No eliminar el archivo ni la función (puede usarse en otros contextos o tests)

- [ ] **6.4** Verificar ausencia de regresión visual:
  - Comparar screenshots post-cambio con los del paso 6.1
  - Verificar especialmente: colores de sidebar, cards de KPI, badges de estado, botones primarios

---

## FASE 7 — Dashboard Híbrido Server/Client Component

> **Riesgo**: 🔴 Alto — refactor mayor del dashboard. Requiere prueba completa en staging.
> **Impacto**: Dashboard visible sin spinner en el primer paint del servidor. KPIs pre-fetched con caché.
> **Dependencia**: **Requiere Fase 2 (auth cacheada) + Fase 4 (KPI cacheado) + Fase 1 (loading.tsx)**.
> **Tiempo estimado**: 4–6h.

### Criterios de verificación

- [ ] El dashboard carga **sin spinner bloqueante** — el contenido inicial (KPIs) es visible en el primer HTML del servidor
- [ ] El drag-and-drop de KPI cards sigue funcionando correctamente
- [ ] El selector de período (día/semana/mes) actualiza los datos correctamente (client-side refresh)
- [ ] `useDashboard` hook recibe `initialKpis` y no hace un fetch inmediato si los datos están presentes
- [ ] `next build` pasa sin errores de tipo Server/Client Component boundary
- [ ] No hay errores de "cannot use hook in server component" en la consola

### Rollback

Restaurar `"use client"` en `src/app/(system-guard)/(protected)/dashboard/page.tsx` y eliminar `dashboard-client-shell.tsx`. El hook vuelve a funcionar como antes.

---

- [x] **7.1** Auditar `src/app/(system-guard)/(protected)/dashboard/page.tsx`:
  - Identificar todos los imports, hooks y state usados (`useState`, `useEffect`, `useDashboard`, `@dnd-kit`)
  - Crear lista de lo que DEBE quedar en Client Component vs lo que puede moverse a Server
  - Verificar cómo se obtiene `activeSucursalId` actualmente (¿Zustand store? ¿header?)

- [x] **7.2** Verificar cómo `activeSucursalId` llega al dashboard:
  - `requireAuth()` retorna `activeSucursalId` directamente desde JWT — confirmado
  - Server Actions usan `requireAuth()` para obtener el contexto de usuario sin Zustand

- [x] **7.3** Crear `src/app/(system-guard)/(protected)/dashboard/actions/dashboard-actions.ts`:
  - **IMPLEMENTADO COMO SERVER ACTIONS** (variación del diseño original — más eficiente)
  - `"use server"` en la primera línea
  - 4 Server Actions: `fetchDashboardKpis`, `fetchDashboardConsignaciones`, `fetchDashboardTopProductos`, `fetchDashboardTendencia`
  - Llaman directamente a `kpi-logic.ts` y Prisma — eliminan roundtrip HTTP

- [x] **7.4** Modificar `src/app/(system-guard)/(protected)/dashboard/hooks/use-dashboard.ts`:
  - Eliminado `import { apiService }` — usa Server Actions directamente
  - Hook actualizado para llamar `fetchDashboardKpis`, `fetchDashboardConsignaciones`, etc.
  - Mantiene capacidad de re-fetch cuando el usuario cambia período

- [x] **7.5** Paginación server-side en `consignaciones/route.ts`:
  - Soporta `?page&limit&search&estado`
  - Retorna `{ data, total, page, limit, totalPages }` con `skip`/`take` de Prisma
  - Backward compatible (sin `page` → devuelve todos)

- [x] **7.6** Paginación server-side en `productos/route.ts`:
  - Soporta `?page&limit&search&categoriaId`
  - Retorna `{ data, total, page, limit, totalPages }` con `skip`/`take` de Prisma
  - Backward compatible

- [x] **7.7** Optimización Sidebar (`sidebar-dock.tsx`):
  - Eliminado `fetch('/api/auth/me')` del cliente
  - Acepta `initialUserData` como prop desde `layout.tsx` (Server Component)
  - Caché en memoria para pedidos-vencidos (60s TTL) y config (5min TTL)
  - Layout pasa `rol`, `sucursalesPermitidas`, `allowConsignaciones` como props

---

## Resumen de Archivos Afectados

| Archivo | Fase | Acción |
|---------|------|--------|
| `src/app/(system-guard)/(protected)/dashboard/loading.tsx` | 1 | **Crear** |
| `src/app/(system-guard)/(protected)/productos/loading.tsx` | 1 | **Crear** |
| `src/app/(system-guard)/(protected)/consignaciones/loading.tsx` | 1 | **Crear** |
| `src/app/(system-guard)/(protected)/clientes/loading.tsx` | 1 | **Crear** |
| `src/app/(system-guard)/(protected)/ventas/loading.tsx` | 1 | **Crear** |
| `src/app/(system-guard)/(protected)/gastos/loading.tsx` | 1 | **Crear** |
| `src/app/(system-guard)/(protected)/pedidos-esperados/loading.tsx` | 1 | **Crear** |
| `src/app/(system-guard)/(protected)/liquidaciones/loading.tsx` | 1 | **Crear** |
| `src/app/(system-guard)/(protected)/caja/loading.tsx` | 1 | **Crear** |
| `src/app/(system-guard)/(protected)/settings/loading.tsx` | 1 | **Crear** |
| `src/app/(system-guard)/(protected)/settings/subscriptions/loading.tsx` | 1 | **Crear** |
| `src/app/(system-guard)/(protected)/settings/branding/loading.tsx` | 1 | **Crear** |
| `src/app/(system-guard)/(protected)/settings/tienda/loading.tsx` | 1 | **Crear** |
| `src/app/(system-guard)/(protected)/settings/whatsapp/loading.tsx` | 1 | **Crear** |
| `src/app/(system-guard)/(protected)/settings/branches/loading.tsx` | 1 | **Crear** |
| `src/app/(system-guard)/(protected)/settings/security/loading.tsx` | 1 | **Crear** |
| `src/app/(system-guard)/(protected)/settings/pos/loading.tsx` | 1 | **Crear** |
| `src/app/(system-guard)/(protected)/settings/notifications/loading.tsx` | 1 | **Crear** |
| `src/lib/requireAuth.ts` | 2 | **Modificar** — agregar `cache()` wrapper |
| `src/app/(system-guard)/(protected)/layout.tsx` | 2, 3 | **Modificar** — usar `requireAuth()` + `checkSubscription()` |
| `src/components/SubscriptionGuard.tsx` | 3 | **Modificar** — convertir en pass-through |
| `src/lib/kpi-logic.ts` | 4 | **Modificar** — agregar `unstable_cache` |
| `src/lib/apiService.ts` | 4 | **Modificar** — cambiar default de `no-store` a `default` |
| `next.config.ts` | 5 | **Modificar** — remotePatterns + formats de imagen |
| `src/app/(system-guard)/(protected)/productos/components/productos-view.tsx` | 5 | **Modificar** — `<img>` → `<Image>` + framer-motion |
| `src/app/(system-guard)/(protected)/settings/branding/page.tsx` | 5 | **Modificar** — `<img>` → `<Image>` |
| `src/app/lista/components/cart-drawer.tsx` | 5 | **Modificar** — `<img>` → `<Image>` + framer-motion |
| `src/app/lista/components/store-footer.tsx` | 5 | **Modificar** — `<img>` → `<Image>` |
| `src/app/lista/components/product-card.tsx` | 5 | **Modificar** — framer-motion |
| `src/app/lista/components/product-modal.tsx` | 5 | **Modificar** — framer-motion |
| `src/app/(system-guard)/(protected)/dashboard/components/tendencia-section.tsx` | 5 | **Modificar** — dynamic import recharts |
| `src/app/(system-guard)/(protected)/dashboard/page.tsx` | 5, 7 | **Modificar** — dynamic dnd-kit + convertir a Server Component |
| *(16 archivos con `framer-motion` listados en 5.2)* | 5 | **Modificar** — migration a `motion/react` |
| `src/app/layout.tsx` | 6 | **Modificar** — eliminar `rootCssVariablesStyle()` |
| `src/lib/theme/color-tokens.ts` | 6 | **Modificar** — agregar JSDoc warning |
| `src/app/(system-guard)/(protected)/dashboard/components/dashboard-client-shell.tsx` | 7 | **Crear** |
| `src/app/(system-guard)/(protected)/dashboard/hooks/use-dashboard.ts` | 7 | **Modificar** — aceptar `initialData` |

---

## Orden de Implementación Recomendado

```
1. Fase 6 (CSS Cleanup)       → 30min  → Sin riesgo, elimina redundancia
2. Fase 1 (loading.tsx × 18)  → 2-3h   → Sin riesgo, pura adición
3. Fase 5A (framer-motion)    → 1-2h   → Riesgo bajo, migración 1:1
4. Fase 5B (dynamic imports)  → 1-2h   → Riesgo bajo, no afecta lógica
5. Fase 5C (next/image)       → 1-2h   → Riesgo bajo, requiere config previa
6. Fase 2 (auth cache)        → 1-2h   → Riesgo medio, probar en staging
7. Fase 4 (KPI cache)         → 1-2h   → Riesgo bajo, datos analíticos
8. Fase 3 (SubscriptionGuard) → 2-3h   → Riesgo medio-alto, cambio de auth flow
9. Fase 7 (Dashboard híbrido) → 4-6h   → Riesgo alto, staging completo
```

**Total estimado**: 14–25h de implementación.

---

## Preguntas Abiertas (bloqueantes antes de implementar)

- [ ] **P1 — Dominio de imágenes en producción**: ¿Las imágenes de productos se sirven desde `/api/files/**` en el mismo servidor, o desde un CDN externo (Cloudinary, S3, R2)? Afecta la configuración de `remotePatterns` en `next.config.ts` (tarea 5.8).
- [ ] **P2 — Invalidación de caché en ventas**: ¿Las operaciones de venta o pago deben invalidar el caché de KPIs inmediatamente? Si sí, agregar `revalidateTag("dashboard")` en los POST handlers correspondientes (tarea 4.2).
- [ ] **P3 — `activeSucursalId` en el dashboard**: ¿El header `x-sucursal-id` llega al Server Component del dashboard? Confirmar que el middleware o el cliente lo inyecta en cada request antes de implementar la Fase 7 (tarea 7.2).
- [ ] **P4 — Persistencia del orden DnD**: ¿El orden de arrastre de los KPI cards se persiste en algún store/DB? Esto afecta cómo el `DashboardClientShell` inicializa su estado en la Fase 7 (tarea 7.3).
