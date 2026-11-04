# ADR 001 — SPA sobre el App Router como modelo de render

## Contexto

La aplicación usa el App Router de Next.js 16, pero en la práctica se comporta
como una SPA: 42 de 47 páginas son `"use client"`, hay 185 archivos cliente y un
solo archivo `"use server"`. El acceso a datos ocurre en el cliente contra 114
route handlers de `/api`, con `src/lib/apiService.ts` (1.225 líneas, ~205
métodos) como cliente HTTP de facto.

La única excepción real es el catálogo público (`src/app/[slug]/page.tsx`,
`src/app/lista/page.tsx`), que es server component con metadata por slug porque
necesita SEO.

Este modelo nunca se declaró. Cada persona que se suma al proyecto asume RSC
porque ve Next.js, y después descubre que el 89 % de las páginas son cliente.

## Opciones

- **A.** Declarar la SPA como modelo oficial y congelarlo.
- **B.** Migrar progresivamente a RSC parcial (dashboard y listados con waterfall).
- **C.** Diferir la decisión hasta tener una medición de bundle.

## Decisión

Se adopta **A**: la SPA sobre el App Router es el modelo oficial del panel, con
el catálogo público como excepción justificada por SEO.

## Motivo

- El sistema funciona y el equipo lo conoce; migrarlo no resuelve un problema
  observado.
- No existe medición de bundle (M15). Optimizar sin baseline es optimizar a
  ciegas, y una migración de 1–2 semanas sin evidencia de que duele es gasto, no
  inversión.
- RSC parcial obligaría a convivir con dos estilos de pantalla y dos formas de
  acceder a datos, justo cuando el problema abierto es lo contrario: 82 % de las
  rutas usando Prisma directo sin patrón común (M12).

## Consecuencias

**A favor**

- Una sola convención para todo el panel: componente cliente → `apiService` →
  `/api` → Prisma.
- La autorización vive en un único lugar verificable (los route handlers), no
  repartida entre server y cliente.
- Las pantallas siguen siendo predecibles para quien las mantiene.

**En contra (aceptado, no oculto)**

- No hay streaming ni `Suspense` en el panel; la pantalla espera el primer fetch.
- No hay caché por tag en pantallas; el catálogo público sí la tiene vía
  `unstable_cache` con `revalidate: 120`.
- El primer render paga el JavaScript del cliente.
- Cada pantalla nueva repite el mismo waterfall: montar → `useEffect` → fetch.

## Reglas operativas

1. Toda pantalla nueva del panel se implementa como componente cliente y consume
   `/api` a través de `src/lib/apiService.ts`. No se agrega `fetch` suelto.
2. Toda ruta pública que deba indexarse (catálogo, tienda) es server component
   con `generateMetadata`. Es la única excepción y está acotada a SEO.
3. No se introducen Server Actions sin un ADR nuevo que reemplace a éste.
4. `export const dynamic = "force-dynamic"` requiere una razón escrita de una
   línea. Se audita en M16.
5. Antes de proponer RSC para cualquier pantalla, hay que tener el baseline de
   bundle de M15 y demostrar que esa pantalla lo excede.

## Cuándo se reabre

Si M15 muestra que el First Load JS de una ruta crítica (POS, dashboard) supera
el presupuesto que se fije, este ADR se revisa con datos. Sin esa medición, la
decisión queda cerrada.
