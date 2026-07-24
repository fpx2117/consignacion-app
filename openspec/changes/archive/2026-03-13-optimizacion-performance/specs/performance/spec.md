# Especificación de Performance — `optimizacion-performance`

> **Tipo**: Especificación Nueva (dominio sin especificación previa)
> **Cambio**: `optimizacion-performance`
> **Proyecto**: `consignacion-app` — Next.js 15 App Router, Prisma, PostgreSQL, Socket.IO
> **Fecha**: 2026-03-13
> **Score objetivo**: ~80/100 (desde ~30/100 actual)

---

## Propósito

Este documento especifica los requisitos de optimización de rendimiento para `consignacion-app`.
Cubre loading states, caché de autenticación, code splitting, gestión de imágenes, animaciones,
variables CSS y arquitectura de componentes del dashboard.

---

## Requisitos

---

### REQ-PERF-01: Loading States por Ruta

Cada ruta protegida dentro de `(system-guard)/(protected)` DEBE tener un archivo `loading.tsx`
colocado en su directorio de ruta correspondiente, con un skeleton visual apropiado al contenido
de esa ruta.

El skeleton DEBE reflejar la estructura aproximada de la página (encabezados, tarjetas, tablas)
y NO DEBE mostrar un spinner genérico de pantalla completa como único indicador de carga.

El archivo `loading.tsx` DEBE exportar un componente por defecto que sea un React Server Component
(sin directiva `"use client"`).

#### Escenario: Ruta protegida cargando por primera vez

- DADO QUE el usuario está autenticado y navega a `/dashboard`
- CUANDO Next.js aún no ha resuelto los datos del Server Component de la página
- ENTONCES el sistema DEBE mostrar el skeleton definido en `dashboard/loading.tsx`
- Y el skeleton DEBE ocupar el mismo espacio visual que el contenido real

#### Escenario: Navegación entre rutas protegidas con Suspense

- DADO QUE el usuario navega desde `/dashboard` hacia `/ventas`
- CUANDO la ruta de destino aún está cargando sus datos
- ENTONCES el sistema DEBE mostrar el skeleton de `ventas/loading.tsx`
- Y NO DEBE mostrar una pantalla en blanco ni el spinner del `SubscriptionGuard`

#### Escenario: Ruta sin archivo loading.tsx (caso negativo)

- DADO QUE una ruta protegida no tiene `loading.tsx`
- CUANDO el usuario navega hacia esa ruta
- ENTONCES el sistema DEBE igualmente completar la navegación (el archivo es requerido pero su ausencia no rompe la app)
- Y el equipo DEBE ser notificado mediante lint o review que falta el archivo

---

### REQ-PERF-02: Caché de Validación de Sesión en `requireAuth()`

La función `requireAuth()` DEBE cachear el resultado de la validación de sesión (consulta a
`prisma.userSession.findUnique`) por al menos 30 segundos por token dentro del mismo request cycle.

El caché DEBE invalidarse automáticamente si el token cambia entre requests.

El caché NO DEBE persistir entre request cycles distintos (no es caché entre usuarios ni entre peticiones HTTP independientes).

La implementación DEBE usar `React.cache()` o `unstable_cache` con un tag por token para lograr
el deduplicado dentro del mismo Server Component tree.

#### Escenario: Múltiples Server Components llaman a `requireAuth()` en el mismo request

- DADO QUE una página tiene tres Server Components que invocan `requireAuth()` con el mismo token
- CUANDO Next.js renderiza la página en el servidor
- ENTONCES `prisma.userSession.findUnique` DEBE ejecutarse exactamente UNA vez por token por request
- Y los tres componentes DEBEN recibir el mismo resultado de validación

#### Escenario: Token diferente en requests consecutivos

- DADO QUE dos requests HTTP llegan con tokens JWT distintos
- CUANDO `requireAuth()` procesa cada request
- ENTONCES DEBE realizar la consulta a la base de datos para cada token distinto
- Y NO DEBE retornar datos de sesión de un token para el otro

#### Escenario: Token inválido o revocado

- DADO QUE la sesión de un usuario ha sido revocada en la base de datos
- CUANDO `requireAuth()` se ejecuta con ese token
- ENTONCES DEBE retornar `{ ok: false }` con status 401
- Y DEBE limpiar la cookie `access_token` en la respuesta

---

### REQ-PERF-03: `SubscriptionGuard` — Spinner de Pantalla Completa

`SubscriptionGuard` NO DEBE bloquear el render con un spinner de pantalla completa (`h-screen w-full`)
durante navegaciones entre rutas que ya fueron autenticadas en la sesión actual.

El componente DEBE cachear el resultado de `/api/subscriptions/current` en memoria del cliente
(zustand store o React context) durante al menos la duración de la sesión activa del usuario,
para evitar re-fetches en cada cambio de ruta.

El spinner de pantalla completa PUEDE mostrarse únicamente en la carga inicial de la aplicación
(primera verificación tras login).

#### Escenario: Primer acceso tras login

- DADO QUE el usuario acaba de autenticarse y accede por primera vez a una ruta protegida
- CUANDO `SubscriptionGuard` verifica el estado de suscripción contra la API
- ENTONCES PUEDE mostrar el spinner de pantalla completa durante esa única verificación inicial
- Y una vez verificado, DEBE cachear el resultado en el cliente

#### Escenario: Navegación entre rutas ya verificadas

- DADO QUE el usuario navegó a `/dashboard` y `SubscriptionGuard` ya verificó la suscripción
- CUANDO el usuario navega a `/ventas` o cualquier otra ruta protegida
- ENTONCES NO DEBE mostrarse el spinner de pantalla completa
- Y el render de la nueva ruta DEBE comenzar sin esperar a `/api/subscriptions/current`

#### Escenario: Suscripción sin acceso

- DADO QUE la verificación inicial determina que el usuario no tiene suscripción activa
- CUANDO `SubscriptionGuard` recibe `hasSubscription: false`
- ENTONCES DEBE redirigir a `/settings/subscriptions`
- Y DEBE limpiar el caché del cliente para esa sesión

---

### REQ-PERF-04: Caché en Rutas de API con Datos Estables

Las rutas de API que retornan datos que no cambian en tiempo real (configuración, catálogos,
listas de referencia) DEBERÍAN usar caché con revalidación mediante `next/cache` o headers HTTP
`Cache-Control` apropiados.

El tiempo de revalidación DEBERÍA ser de al menos 60 segundos para datos semi-estáticos.

Las rutas de API que consumen datos en tiempo real (ventas activas, stock en movimiento, Socket.IO)
NO DEBEN aplicar caché a nivel de response HTTP.

#### Escenario: Ruta de API de datos de configuración

- DADO QUE `/api/settings/config` retorna la configuración de la tienda
- CUANDO un cliente realiza un GET a ese endpoint
- ENTONCES la respuesta DEBERÍA incluir `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`
- Y Next.js DEBERÍA retornar la respuesta cacheada para requests subsiguientes dentro del período

#### Escenario: Ruta de API de datos en tiempo real

- DADO QUE `/api/ventas/live` retorna el estado de ventas en curso
- CUANDO un cliente realiza un GET a ese endpoint
- ENTONCES la respuesta DEBE incluir `Cache-Control: no-store`
- Y DEBE retornar datos frescos en cada request

#### Escenario: Revalidación tras mutación

- DADO QUE un usuario actualiza la configuración de la tienda
- CUANDO la mutación se completa exitosamente
- ENTONCES el sistema DEBERÍA invalidar el caché de `/api/settings/config`
- Y la próxima petición DEBE obtener datos actualizados

---

### REQ-PERF-05: Dashboard KPIs con `unstable_cache`

La función `getDashboardKpis` en `src/lib/kpi-logic.ts` DEBE ser envuelta con `unstable_cache`
de Next.js con un tiempo de revalidación (`revalidate`) de 60 segundos.

El caché DEBE estar segmentado por los parámetros `sucursalId` y `period` para evitar colisión
entre distintas sucursales o períodos.

Las tags de caché DEBEN incluir al menos: `["dashboard-kpis", "sucursal-{sucursalId}", "period-{period}"]`.

La función DEBE ser revalidada on-demand mediante `revalidateTag("dashboard-kpis")` cuando se
registre una nueva venta, gasto o liquidación.

#### Escenario: Múltiples usuarios ven el dashboard simultáneamente

- DADO QUE dos usuarios de la misma sucursal acceden a `/dashboard` con el mismo período
- CUANDO `getDashboardKpis` se ejecuta
- ENTONCES la función DEBE ejecutar las queries SQL exactamente UNA vez y servir la respuesta cacheada al segundo usuario
- Y el tiempo de respuesta del segundo usuario DEBE ser menor a 100ms

#### Escenario: Revalidación por registro de venta nueva

- DADO QUE se registra una nueva venta en el sistema
- CUANDO la operación de creación se confirma en la base de datos
- ENTONCES el sistema DEBE llamar a `revalidateTag("dashboard-kpis")`
- Y la próxima visita al dashboard DEBE mostrar los KPIs actualizados

#### Escenario: Distintas sucursales no comparten caché

- DADO QUE `sucursal-1` y `sucursal-2` acceden al dashboard con el período `"today"`
- CUANDO `getDashboardKpis` se ejecuta para cada una
- ENTONCES DEBEN tener entradas de caché independientes
- Y los datos de `sucursal-1` NO DEBEN aparecer en el dashboard de `sucursal-2`

#### Escenario: Revalidación por tiempo expirado

- DADO QUE el caché de KPIs fue generado hace 61 segundos
- CUANDO un usuario accede al dashboard
- ENTONCES Next.js DEBE ejecutar `getDashboardKpis` de forma nueva en background
- Y DEBE servir la respuesta stale inmediatamente mientras revalida (stale-while-revalidate)

---

### REQ-PERF-06: Unificación de Librería de Animaciones

El proyecto DEBE usar únicamente `motion/react` (el paquete `motion`) como fuente de importación
de animaciones, eliminando cualquier import directo desde `framer-motion`.

No DEBE existir ningún archivo con `import ... from 'framer-motion'` en el proyecto una vez
aplicado este cambio.

El package `framer-motion` NO DEBE listarse como dependencia directa en `package.json`
si ya está presente como subdependencia de `motion`.

Todos los componentes que actualmente importan desde `framer-motion` DEBEN migrar sus imports
a `motion/react` manteniendo la misma API de componentes (`motion.div`, `AnimatePresence`, etc.).

#### Escenario: Componente usando import de framer-motion

- DADO QUE un componente tiene `import { motion } from 'framer-motion'`
- CUANDO se aplica la migración
- ENTONCES el import DEBE actualizarse a `import { motion } from 'motion/react'`
- Y el comportamiento visual del componente DEBE ser idéntico

#### Escenario: Verificación de no duplicación de librería

- DADO QUE el proyecto tiene `motion` en `package.json`
- CUANDO se ejecuta `npm ls framer-motion`
- ENTONCES `framer-motion` NO DEBE aparecer como dependencia directa en el `package.json` raíz
- Y el bundle final DEBE incluir solo una versión del runtime de animaciones

#### Escenario: AnimatePresence en navegaciones

- DADO QUE se usa `AnimatePresence` para transiciones de rutas
- CUANDO el import se migra a `motion/react`
- ENTONCES las transiciones DEBEN continuar funcionando correctamente
- Y NO DEBE haber errores de hydration en el cliente

---

### REQ-PERF-07: Imágenes de Productos con `next/image`

Todas las imágenes de productos mostradas en la aplicación DEBEN usar el componente `<Image>`
de `next/image` en lugar de la etiqueta `<img>` nativa de HTML.

Los componentes afectados incluyen al menos: `product-card.tsx`, `product-modal.tsx`,
`cart-item-card.tsx`, `product-selector.tsx`, `store-banner.tsx`, `store-header.tsx`,
`store-footer.tsx`, `BrandingTab.tsx` y `productos-view.tsx`.

El componente `<Image>` DEBE configurarse con los atributos `width`, `height` (o `fill` con
contenedor relativo), y `alt` descriptivo en cada instancia.

Los dominios de imágenes externas DEBEN estar declarados en `next.config.ts` bajo
`images.remotePatterns`.

#### Escenario: Imagen de producto en la lista pública

- DADO QUE el catálogo público muestra productos con imágenes almacenadas en un CDN externo
- CUANDO se renderiza `product-card.tsx`
- ENTONCES DEBE usar `<Image src={url} width={...} height={...} alt={nombre} />`
- Y Next.js DEBE servir la imagen optimizada (WebP/AVIF) con lazy loading automático

#### Escenario: Imagen con URL no declarada en remotePatterns

- DADO QUE una imagen proviene de un dominio no declarado en `next.config.ts`
- CUANDO Next.js intenta optimizarla
- ENTONCES DEBE lanzar un error descriptivo en desarrollo
- Y el equipo DEBE agregar el dominio a `remotePatterns` antes del deploy

#### Escenario: Imagen sin dimensiones definidas (fill mode)

- DADO QUE el contenedor de la imagen tiene `position: relative` y dimensiones definidas por CSS
- CUANDO se usa `<Image fill />`
- ENTONCES la imagen DEBE cubrir el contenedor sin distorsión
- Y DEBE aplicarse `object-fit: cover` mediante la prop `className` o `style`

---

### REQ-PERF-08: Code Splitting de Librerías Pesadas

Las librerías de alto peso (`recharts`, `@dnd-kit/*`, `@mercadopago/sdk-react`,
`@paypal/react-paypal-js`) DEBEN cargarse de forma diferida usando `next/dynamic` con `ssr: false`
cuando corresponda.

Cada componente que use estas librerías DEBE ser envuelto en un `dynamic()` call desde el
componente padre que lo importa, o el componente mismo DEBE exportarse como una exportación
dinámica.

El tiempo de carga inicial del dashboard (LCP) DEBE mejorar al menos un 20% respecto al baseline
de ~30/100 al implementar este requisito.

Los componentes cargados dinámicamente DEBEN tener un `loading` prop definido con un skeleton
apropiado para evitar layout shift (CLS).

#### Escenario: Carga del dashboard sin recharts

- DADO QUE el usuario navega al dashboard
- CUANDO la página carga inicialmente
- ENTONCES el bundle inicial NO DEBE incluir `recharts` en el chunk principal
- Y `recharts` DEBE cargarse en un chunk separado solo cuando el componente de gráficos entra al viewport

#### Escenario: Componente DnD en vista de productos

- DADO QUE la vista de productos usa `@dnd-kit` para reordenamiento
- CUANDO la página carga
- ENTONCES `@dnd-kit` DEBE cargarse dinámicamente con `next/dynamic({ ssr: false })`
- Y DEBE mostrarse un skeleton o placeholder mientras `@dnd-kit` carga

#### Escenario: SDK de pago en la página de suscripciones

- DADO QUE `@mercadopago/sdk-react` solo se usa en `/settings/subscriptions`
- CUANDO el usuario está en cualquier otra ruta
- ENTONCES el SDK de MercadoPago NO DEBE estar presente en el bundle de esa ruta
- Y DEBE cargarse solo cuando el usuario navega a `/settings/subscriptions`

#### Escenario: Loading placeholder de componente dinámico

- DADO QUE un componente pesado se carga con `next/dynamic`
- CUANDO aún no se ha descargado el chunk
- ENTONCES DEBE renderizarse el skeleton definido en la prop `loading`
- Y NO DEBE ocurrir un layout shift (CLS score DEBE ser < 0.1)

---

### REQ-PERF-09: Variables CSS Sin Duplicación

Las variables CSS del sistema de diseño NO DEBEN definirse en dos lugares distintos
simultáneamente dentro del mismo proyecto.

El archivo `src/app/globals.css` NO DEBE contener más de un bloque `:root { }` con
definiciones de variables de color o de tema.

Las variables de tema (colores, espaciados, tipografía) DEBEN tener una única fuente de verdad:
el bloque `:root` principal de `globals.css`.

El archivo `tailwind.config.ts` PUEDE referenciar variables CSS usando `hsl(var(--nombre))`
pero NO DEBE redefinir los valores de esas variables.

#### Escenario: Dos bloques `:root` en globals.css (caso actual)

- DADO QUE `globals.css` tiene dos bloques `:root` (en líneas 111 y 355)
- CUANDO se aplica la migración
- ENTONCES DEBE existir exactamente UN bloque `:root` consolidado con todas las variables
- Y las variables duplicadas DEBEN fusionarse manteniendo el valor correcto (el último en cascada)

#### Escenario: Variable redefinida con valor diferente

- DADO QUE una variable como `--primary` aparece con valores distintos en cada bloque `:root`
- CUANDO se consolida en un único bloque
- ENTONCES el equipo DEBE decidir y documentar cuál valor es el canónico
- Y el valor final DEBE ser consistente con el diseño visual de la aplicación

#### Escenario: Verificación de integridad post-migración

- DADO QUE se consolidaron los bloques `:root`
- CUANDO se ejecuta la aplicación en desarrollo
- ENTONCES todos los colores y variables deben renderizarse correctamente en modo claro y oscuro
- Y NO DEBE haber regresiones visuales en componentes que dependían del segundo bloque `:root`

---

### REQ-PERF-10: Server Components en el Dashboard

Al menos el 50% del árbol de componentes de la ruta `/dashboard` DEBERÍA ser implementado
como React Server Components (RSC), eliminando la directiva `"use client"` donde no sea estrictamente necesaria.

Un componente PUEDE ser Client Component únicamente si requiere: hooks de estado (`useState`, `useEffect`),
event handlers, acceso a APIs del browser, o contextos de cliente como zustand.

Los componentes que solo renderizan datos estáticos o fetched data DEBERÍAN ser Server Components.

El componente raíz de la ruta (`dashboard/page.tsx`) DEBE ser un Server Component que
haga data fetching directo y pase los datos como props a los Client Components necesarios.

#### Escenario: Componente de KPI card sin interactividad

- DADO QUE `kpi-card.tsx` solo renderiza valores numéricos y labels recibidos como props
- CUANDO se evalúa su arquitectura
- ENTONCES DEBERÍA ser un Server Component sin `"use client"`
- Y los datos DEBEN ser pasados como props desde el Server Component padre

#### Escenario: Componente de gráfico con interactividad

- DADO QUE el gráfico de ventas usa recharts (librería de cliente) y tiene tooltips interactivos
- CUANDO se evalúa su arquitectura
- ENTONCES DEBE ser un Client Component con `"use client"`
- Y DEBE recibir los datos como props desde un Server Component padre (no hacer fetch propio)

#### Escenario: Layout del dashboard

- DADO QUE `dashboard/layout.tsx` no tiene lógica de cliente
- CUANDO se evalúa su arquitectura
- ENTONCES DEBE ser un Server Component
- Y el data fetching de KPIs DEBE ocurrir en `dashboard/page.tsx` (Server Component) y no en hooks de cliente

#### Escenario: Verificación de proporción Server/Client

- DADO QUE se completó la refactorización del dashboard
- CUANDO se analiza el árbol de componentes con React DevTools o el bundle analyzer
- ENTONCES al menos el 50% de los componentes del árbol de `/dashboard` DEBEN ser Server Components
- Y el bundle de JavaScript enviado al cliente DEBE reducirse al menos un 15% respecto al baseline

---

## Resumen de Cobertura

| REQ         | Nombre                    | Nivel   | Escenarios Happy Path | Escenarios Edge Case |
| ----------- | ------------------------- | ------- | --------------------- | -------------------- |
| REQ-PERF-01 | Loading States            | DEBE    | ✅                    | ✅                   |
| REQ-PERF-02 | Auth Cache                | DEBE    | ✅                    | ✅                   |
| REQ-PERF-03 | SubscriptionGuard Spinner | NO DEBE | ✅                    | ✅                   |
| REQ-PERF-04 | API Cache                 | DEBERÍA | ✅                    | ✅                   |
| REQ-PERF-05 | Dashboard KPIs Cache      | DEBE    | ✅                    | ✅                   |
| REQ-PERF-06 | Animaciones Unificadas    | DEBE    | ✅                    | ✅                   |
| REQ-PERF-07 | Imágenes con next/image   | DEBE    | ✅                    | ✅                   |
| REQ-PERF-08 | Code Splitting            | DEBE    | ✅                    | ✅                   |
| REQ-PERF-09 | CSS Variables Sin Dup.    | NO DEBE | ✅                    | ✅                   |
| REQ-PERF-10 | Server Components         | DEBERÍA | ✅                    | ✅                   |

**Total**: 10 requisitos · 27 escenarios · 100% con cobertura happy path + edge case
