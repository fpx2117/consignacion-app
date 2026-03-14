# Propuesta: Optimización de Performance

**Cambio**: `optimizacion-performance`  
**Fecha**: 13 de marzo de 2026  
**Estado**: 🟡 Borrador  
**Autor**: JARVIS (Subagente SDD)  
**Prioridad**: 🔴 Crítica

---

## Intención

El sistema `consignacion-app` presenta un score de performance estimado de **~30/100**, lo cual impacta directamente en la experiencia de los usuarios del POS, los consignatarios y los administradores. El tiempo de carga percibido es inaceptable: pantallas en blanco durante navegaciones, N queries redundantes a la base de datos por cada request autenticado, y un bundle inicial inflado con librerías que no se necesitan al primer render.

Esta propuesta describe el conjunto de intervenciones técnicas necesarias para llevar el score a **~80/100**, atacando los diez problemas críticos identificados en el análisis de exploración. El objetivo no es solo pasar un benchmark, sino que el sistema se sienta **extremadamente rápido** para el usuario final.

---

## Alcance

### ✅ Dentro del Alcance

1. **Crear archivos `loading.tsx`** en cada ruta protegida para eliminar pantallas en blanco durante navegaciones con React Suspense.
2. **Cachear `requireAuth()`** con un mecanismo de deduplicación por request (React `cache()` o similar) para eliminar N queries idénticas a la DB.
3. **Refactorizar `SubscriptionGuard`** para no bloquear la navegación interna con un spinner innecesario.
4. **Corregir `apiService.ts`** eliminando el `cache: "no-store"` global y reemplazándolo por estrategias de caché granulares por endpoint.
5. **Migrar `getDashboardKpis`** para usar `unstable_cache` de Next.js, reduciendo las 14 queries a 1 por período de revalidación.
6. **Convertir el Dashboard** de componente cliente monolítico a arquitectura mixta Server/Client Components.
7. **Deduplicar dependencias de animación**: eliminar la duplicación entre `framer-motion` y `motion/react`, quedando con una sola librería.
8. **Reemplazar `<img>` nativo** con `next/image` en todos los puntos de uso para obtener lazy loading y WebP automáticos.
9. **Implementar `dynamic()` con `ssr: false`** para `recharts`, SDKs de pago y `@dnd-kit`, sacándolos del bundle inicial.
10. **Consolidar variables CSS** eliminando la duplicación entre `globals.css` y `color-tokens.ts`.

### 🚫 Fuera del Alcance

- Cambio de base de datos o proveedor de hosting.
- Optimización de queries SQL avanzadas (índices, particionado) — eso es un cambio separado.
- Implementación de Redis o caché distribuida — la caché en memoria y `unstable_cache` son suficientes para la fase actual.
- Modificación de la lógica de negocio de consignación.
- Tests de carga o stress testing de la infraestructura.
- SEO u optimizaciones de Lighthouse que no sean performance pura.

---

## Enfoque

El cambio se ejecuta en **cuatro fases ordenadas por impacto/riesgo**:

### Fase 1 — Quick Wins de Percepción (Impacto inmediato, riesgo nulo)
Crear los archivos `loading.tsx` en cada ruta protegida. Son archivos nuevos, no modifican nada existente. Elimina el 100% de las pantallas en blanco.

### Fase 2 — Caché de Autenticación y KPIs (Impacto alto, riesgo bajo)
Envolver `requireAuth()` con `React.cache()` para deduplicar queries por request. Aplicar `unstable_cache` a `getDashboardKpis` con revalidación por tiempo. Ambas son modificaciones internas sin cambio de API pública.

### Fase 3 — Arquitectura de Componentes (Impacto medio, riesgo medio)
Refactorizar el dashboard para separar Server Components de Client Components. Corregir `apiService.ts` para usar caché granular. Refactorizar `SubscriptionGuard` para que no bloquee la navegación.

### Fase 4 — Bundle y Assets (Impacto medio, riesgo bajo-medio)
Aplicar `dynamic()` a librerías pesadas. Migrar `<img>` a `next/image`. Deduplicar `framer-motion`. Consolidar variables CSS.

---

## Áreas Afectadas

| Área | Impacto | Descripción |
|------|---------|-------------|
| `src/lib/requireAuth.ts` | Modificado | Agregar `React.cache()` para deduplicar queries de autenticación por request |
| `src/lib/apiService.ts` | Modificado | Eliminar `cache: "no-store"` global; implementar caché granular por endpoint |
| `src/lib/kpi-logic.ts` | Modificado | Envolver `getDashboardKpis` con `unstable_cache`; revalidar por tiempo |
| `src/components/SubscriptionGuard.tsx` | Modificado | Eliminar bloqueo spinner en navegaciones internas; verificar suscripción solo en entry point |
| `src/middleware.ts` | Modificado (menor) | Ajustar si se delega verificación de auth al middleware para reducir carga en Server Components |
| `src/app/(system-guard)/(protected)/dashboard/page.tsx` | Modificado | Migrar de 100% cliente a arquitectura mixta; separar secciones estáticas como Server Components |
| `src/app/(system-guard)/(protected)/*/loading.tsx` | **Nuevo** | Crear skeleton UI en cada ruta protegida (dashboard, productos, ventas, etc.) |
| `src/app/(system-guard)/(protected)/productos/components/productos-view.tsx` | Modificado | Aplicar `dynamic()` a componentes pesados; optimizar re-renders |
| `src/app/lista/page.tsx` | Modificado | Reemplazar `<img>` con `next/image`; revisar estrategia de caché |
| `src/lib/theme/color-tokens.ts` | Modificado | Eliminar variables duplicadas con `globals.css`; source of truth único |
| `next.config.ts` | Modificado | Configurar dominios de imágenes para `next/image`; revisar configuración de bundle |
| `package.json` | Modificado | Eliminar librería duplicada de animación (`framer-motion` o `motion/react`) |

---

## Riesgos

| Riesgo | Probabilidad | Severidad | Mitigación |
|--------|--------------|-----------|------------|
| `unstable_cache` devuelve datos obsoletos en el dashboard | Media | Media | Configurar `revalidate` con tiempo corto (60s); exponer botón de refresco manual si se requiere |
| Migración de Server Components rompe componentes que usan hooks de cliente | Media | Alta | Auditar uso de `useState`/`useEffect` antes de migrar; mover hooks a subcomponentes cliente explícitos |
| Eliminar `framer-motion` o `motion/react` rompe animaciones existentes | Baja | Media | Auditar imports antes de eliminar; unificar en la librería con más uso actual |
| `next/image` requiere configuración de dominios para imágenes externas | Media | Baja | Relevar todas las URLs de imágenes externas antes de migrar; configurar `remotePatterns` en `next.config.ts` |
| `dynamic()` con `ssr: false` rompe SSR de páginas que usan esas librerías | Baja | Media | Aplicar solo a componentes que no necesitan SSR; verificar en `next build` |
| Caché de `requireAuth()` filtra datos entre usuarios en el mismo request | Muy Baja | Crítica | Usar `React.cache()` que scopes por request, no global; nunca usar módulo-level cache para auth |
| Consolidación de CSS variables rompe el tema visual | Baja | Media | Snapshot visual antes y después; `globals.css` como fuente de verdad, `color-tokens.ts` la consume |

---

## Plan de Reversión (Rollback)

El diseño del cambio es **aditivo y modular**: cada intervención es independiente y reversible.

### Rollback por Área

| Intervención | Rollback |
|---|---|
| Archivos `loading.tsx` | Eliminar los archivos; sin impacto funcional ni en datos |
| `requireAuth()` con caché | Revertir a la versión sin `React.cache()`; una línea de cambio |
| `apiService.ts` sin `cache: "no-store"` | Restaurar `cache: "no-store"` global; deshabilita toda la caché de Next.js |
| `getDashboardKpis` con `unstable_cache` | Eliminar el wrapper; vuelve a las 14 queries directas |
| Refactorización del Dashboard | Git revert del commit de refactorización |
| `dynamic()` en librerías | Revertir a imports directos; sin efecto en lógica |
| `next/image` | Revertir a `<img>` nativo; sin efecto en datos |
| Deduplicación de animación | Restaurar ambas dependencias en `package.json` |

### Estrategia General
- Cada fase se commitea de forma atómica y con tag de versión antes de continuar a la siguiente.
- Si el build de producción falla en alguna fase, el revert es al tag anterior.
- **Feature flag de emergencia**: restaurar `cache: "no-store"` en `apiService.ts` deshabilita toda la capa de caché en menos de 2 minutos.

---

## Dependencias

- Next.js 15 (App Router) — ya instalado. `React.cache()`, `unstable_cache` y `Suspense` están disponibles.
- `next/image` — incluido en el core de Next.js, no requiere instalación extra.
- Acceso a todas las rutas protegidas para crear `loading.tsx` en cada una.
- Inventario de todas las imágenes externas para configurar `remotePatterns` en `next.config.ts`.
- Determinar cuál de las dos librerías de animación (`framer-motion` o `motion/react`) tiene más cobertura de uso en el proyecto.

---

## Criterios de Éxito

- [ ] **Score Lighthouse Performance ≥ 80/100** medido en producción (o staging con condiciones similares).
- [ ] **Cero pantallas en blanco** durante navegaciones entre rutas protegidas — Suspense activo en todas las rutas.
- [ ] **`requireAuth()` ejecuta máximo 1 query por request** — verificado con logs de Prisma.
- [ ] **`getDashboardKpis` no hace queries en cada request** cuando el caché está activo — verificado con `EXPLAIN` o logs.
- [ ] **Bundle inicial reducido en ≥ 30%** — verificado con `next build` y análisis del bundle output.
- [ ] **Dashboard carga en < 2 segundos** en condición de red "Fast 3G" (Lighthouse simulation).
- [ ] **Todas las imágenes servidas en WebP** con lazy loading confirmado en DevTools.
- [ ] **Cero errores en `next build`** y `next start` después de todos los cambios.
- [ ] **Una sola librería de animación** en `node_modules` (no ambas en el bundle final).
- [ ] **`globals.css` y `color-tokens.ts` sin duplicaciones** — verificado con búsqueda de variables CSS cruzadas.
