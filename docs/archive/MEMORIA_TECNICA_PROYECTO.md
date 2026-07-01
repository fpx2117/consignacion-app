> **ARCHIVADO (2026-06-30):** el contenido único de este documento (mapa "dónde tocar según el cambio" y reglas de negocio) se movió a [../GUIA_CAMBIOS.md](../GUIA_CAMBIOS.md). El resto (arquitectura, stack, estructura de carpetas, variables de entorno) duplicaba [../GUIA_TECNICA_PROYECTO.md](../GUIA_TECNICA_PROYECTO.md) y [../MANUAL_SISTEMA.md](../MANUAL_SISTEMA.md), que son ahora la fuente de verdad. Se conserva aquí solo como referencia histórica.

# Memoria Tecnica del Proyecto

## 1. Proposito del proyecto

`consignacion-app` es una aplicacion fullstack monolitica construida sobre `Next.js 16`, `React 19`, `Prisma 7`, `PostgreSQL` y un servidor custom en `server.ts` que integra `Socket.IO`.

No es solo una tienda online. El sistema combina, dentro del mismo arbol de codigo, estos modulos principales:

- Backoffice comercial para administracion de un comercio.
- Punto de venta (POS) para ventas presenciales.
- Gestion de stock por sucursal.
- Flujo de consignaciones y liquidaciones.
- Tienda publica por sucursal con branding y checkout.
- Suscripciones SaaS, onboarding pago y limites por plan.
- Reportes PDF/HTML compartibles.
- Notificaciones en tiempo real.

## 2. Modelo de negocio inferido

El modelo de negocio implementado en codigo es **SaaS B2B para comercios**.

La evidencia mas fuerte aparece en:

- `package.json` y `README.md`, que describen el producto como sistema integral POS y consignaciones.
- `prisma/schema.prisma`, que incluye `Plan`, `PlanLimit`, `Subscription`, `PromoCode`, `CheckoutIntent` y configuracion comercial avanzada.
- `src/constants/subscriptions.ts`, donde se definen capacidades y limites del producto.
- `src/lib/subscriptions/require-subscription.ts`, donde el backend hace cumplir limites y acceso a funcionalidades.
- `src/app/api/setup/initialize/route.ts`, donde el onboarding exige suscripcion o promo code antes de terminar la configuracion.

### Lectura de negocio

- El cliente del sistema es el duenio o administrador de un comercio.
- El usuario final interno puede ser `ADMIN` o `EMPLEADO`.
- Cada comercio opera una o varias sucursales.
- La tienda publica funciona como canal de venta complementario de cada sucursal.
- La monetizacion principal del producto es por suscripcion.
- Para la tienda publica, cada comercio puede usar sus propias credenciales de Mercado Pago, lo que sugiere que el SaaS cobra por uso/plano y no necesariamente por comision transaccional.

## 3. Arquitectura general

## 3.1 Estilo arquitectonico

Arquitectura monolitica fullstack con separacion logica por capas dentro de un mismo repositorio:

- UI, rutas y layouts en `src/app`.
- APIs internas en `src/app/api`.
- Servicios, reglas de negocio e integraciones en `src/lib`.
- Persistencia en Prisma/PostgreSQL.
- Tiempo real en el mismo proceso Node mediante `Socket.IO`.

## 3.2 Runtime real

El runtime no es `next dev`/`next start` puro.

- `server.ts` levanta un servidor HTTP Node.
- Ese servidor monta Next.js y `Socket.IO` en el mismo proceso.
- El script `npm run dev` ejecuta `tsx server.ts`.
- El script `npm start` aplica migraciones y luego ejecuta `tsx server.ts` en produccion.

Esto es importante porque cualquier cambio en tiempo real, CORS, sockets, health checks o despliegue debe mirar primero `server.ts`.

## 3.3 Persistencia

- Base principal: PostgreSQL.
- ORM: Prisma con adapter `@prisma/adapter-pg`.
- Cliente singleton: `src/lib/prisma.ts`.
- Modelo de datos principal: `prisma/schema.prisma`.

El esquema modela usuarios, sucursales, configuracion, clientes, productos, stock, ventas, pagos, consignaciones, liquidaciones, gastos, reportes, share links y suscripciones.

## 3.4 Seguridad

- Autenticacion basada en JWT + cookies en `src/lib/auth/core.ts`.
- Validacion de sesion y sucursal activa en `src/lib/auth/require-auth.ts`.
- Restricciones de navegacion en `src/proxy.ts`.
- Hay seguimiento de sesiones, auditoria y monitoreo de seguridad en `src/lib/security` y utilidades relacionadas.

## 3.5 Tiempo real

- Servidor socket integrado en `server.ts`.
- Provider cliente en `src/providers/socket-provider.tsx`.
- Las notificaciones se despachan internamente por `/api/socket/dispatch`.

## 3.6 Reportes y documentos

- Generacion PDF server-side con Puppeteer.
- Templates y helpers en `src/lib/reports`.
- Vistas renderizables/compartibles en `src/app/ver`.
- Share links en `src/lib/share-links.ts` y `src/app/x/[code]/route.ts`.

## 4. Estructura real de carpetas

Esta memoria se basa en la estructura real del proyecto, no en una separacion teorica frontend/backend.

### Raiz del proyecto

- `README.md`: vision general del sistema y stack.
- `DOCUMENTACION.md`: documentacion tecnica historica/general.
- `docs/`: documentacion tecnica nueva, ADRs, seguridad, integraciones y referencias.
- `server.ts`: servidor custom Node + Next + Socket.IO.
- `package.json`: scripts, dependencias y runtime real.
- `prisma/`: esquema, migraciones y seed.
- `src/`: codigo principal de la aplicacion.
- `scripts/`: scripts operativos, correctivos y de mantenimiento.
- `public/`: assets publicos.
- `tests/`: pruebas y soporte auxiliar.
- `design-system/`, `Gentleman-Skills/`, `openspec/`, `DOCUMENTATION/`: carpetas auxiliares/documentales que no son el corazon del runtime productivo.

### `src/`

- `src/app/`: rutas App Router, paginas, layouts, flows y APIs.
- `src/components/`: componentes UI compartidos.
- `src/lib/`: servicios, integraciones, reglas de negocio y helpers.
- `src/providers/`: providers de runtime, especialmente sockets.
- `src/store/`: estado global con Zustand.
- `src/types/`: tipos compartidos.
- `src/constants/`: constantes funcionales como suscripciones y limites.

### `src/app/`

- `(system-guard)/`: area principal de aplicacion con control de inicializacion y acceso.
- `(system-guard)/(protected)/`: panel autenticado real.
- `api/`: route handlers de backend.
- `lista/`: tienda publica/canal online por sucursal.
- `setup/`: onboarding inicial del sistema.
- `ver/`: vistas HTML/PDF/reportes.
- `x/`: resolucion de share links.
- `consignacion-loading/` y `ticket-loading/`: estados de carga especializados.

### `src/app/(system-guard)/(protected)/`

Es la zona principal del backoffice. Aca viven modulos como:

- `dashboard`
- `ventas`
- `clientes`
- `productos`
- `consignaciones`
- `liquidaciones`
- `caja`
- `gastos`
- `pedidos-esperados`
- `settings`

Si el cambio es funcional y visible para usuarios internos, casi seguro toca esta zona o sus APIs asociadas.

### `src/app/api/`

Es el backend HTTP real del proyecto. No es una capa secundaria: aca vive gran parte de la logica operativa.

Zonas destacadas:

- `auth/`: login, logout, recovery, sesiones.
- `ventas/`: POS, pagos, anulaciones, validaciones.
- `consignaciones/`: remitos, entregas, control de stock consignado.
- `liquidaciones/`: cierre y rendicion de consignaciones.
- `dashboard/`: KPIs y panel.
- `public/`: catalogo publico, checkout, branding, pedidos externos.
- `setup/`: inicializacion y activacion comercial.
- `webhooks/`: callbacks de Mercado Pago y PayPal.
- `cron/`: tareas programadas protegidas por secreto.
- `settings/`: configuraciones operativas, branding, POS, cajas y tienda.

### `src/lib/`

Es el corazon tecnico del proyecto.

Subzonas y archivos importantes:

- `auth/`: autenticacion y sesiones.
- `payments/`: integracion SaaS con Mercado Pago y PayPal.
- `notificaciones/`: logica de notificaciones.
- `reports/`: templates y logica de reportes.
- `security/`: higiene y utilidades de seguridad.
- `subscriptions/`: limites, reglas y enforcement comercial.
- `validators/`: esquemas Zod y validacion por dominio.
- `public-catalog.ts`: construccion de datos publicos de la tienda.
- `catalog-cart-pricing.ts`: pricing del carrito/catalogo.
- `sucursalScope.ts`: contrato de aislamiento por sucursal.
- `apiService.ts`: fachada grande de consumo API del frontend.
- `uploads.ts`: politica de uploads y archivos.
- `andreaniService.ts`: integracion con envios Andreani.

### `src/components/`

Componentes reutilizables de UI y shell de aplicacion.

Piezas importantes:

- `sidebar/` y `sidebar-dock.tsx`: navegacion principal.
- `top-bar.tsx`: cabecera global.
- `notifications-panel.tsx`: notificaciones.
- `SubscriptionGuard.tsx`: control visual por suscripcion.
- `global-readonly-guard.tsx`: protecciones de uso.
- `theme-provider.tsx`, `ThemeInjector.tsx`: look & feel.
- `ui/`: primitives/estilo base.

### `prisma/`

- `schema.prisma`: fuente principal del modelo de datos.
- `migrations/`: migraciones reales.
- `seed.ts`: datos iniciales.

Tambien hay archivos heredados como `schema copy.prisma`, `schema_v2.prisma`, `schema_v3.prisma`, `schema_hopper.prisma`, `seed copy.ts`. Deben tratarse como artefactos historicos o auxiliares, no como la fuente actual de verdad.

### `scripts/`

Scripts operativos y correctivos. No asumir que son solo dev tools.

Hay scripts asociados a:

- migraciones/problematicas de Prisma
- sincronizacion de stock
- seguridad y escaneo de secretos
- tareas de mantenimiento

## 5. Archivos mas importantes y su responsabilidad

### Infraestructura y arranque

- `package.json`
  - Define el runtime real del proyecto.
  - Muestra que `dev` usa `tsx server.ts`.
  - `build` y `start` incluyen trabajo de Prisma y una limpieza manual de una migracion problematica.

- `server.ts`
  - Levanta Next.js y `Socket.IO`.
  - Maneja handshake de sockets.
  - Expone el endpoint interno de despacho de eventos.
  - Define host/puerto para despliegue.

### Modelo de datos

- `prisma/schema.prisma`
  - Es el mapa del negocio real.
  - Aca se entienden entidades, relaciones, historicos y modulos.

- `prisma/seed.ts`
  - Permite inicializar datos base.

### Seguridad y acceso

- `src/lib/auth/core.ts`
  - Firma/valida JWT y maneja cookies.

- `src/lib/auth/require-auth.ts`
  - Guardia principal de APIs.
  - Resuelve usuario, sesion, rol y sucursal activa.

- `src/proxy.ts`
  - Restringe acceso por autenticacion y por rol en navegacion.

### Multi-sucursal

- `src/lib/sucursalScope.ts`
  - Establece como se interpreta la sucursal activa.
  - Define el comportamiento de vista global y filtros.

- `src/store/useSucursalStore.ts`
  - Estado cliente de sucursal activa.

### Operacion comercial

- `src/app/api/ventas/route.ts`
  - Uno de los centros operativos del sistema.
  - Valida autenticacion, caja, stock, pagos, numeracion y persistencia de ventas.

- `src/app/api/consignaciones/route.ts`
  - Alta de consignaciones.
  - Maneja folio secuencial y stock consignado.

- `src/app/api/liquidaciones/*`
  - Cierre y rendicion del flujo de consignaciones.

### Tienda publica y checkout

- `src/app/lista/page.tsx`
  - Entrada principal de la tienda publica.

- `src/lib/public-catalog.ts`
  - Construye el catalogo publico y la presentacion comercial.

- `src/app/api/public/checkout/route.ts`
  - Checkout publico con Mercado Pago.

- `src/lib/catalog-cart-pricing.ts`
  - Reglas de pricing del carrito/catalogo.

### Suscripciones y monetizacion SaaS

- `src/constants/subscriptions.ts`
  - Planes, capacidades y limites.

- `src/lib/subscriptions/require-subscription.ts`
  - Hace cumplir reglas de plan desde backend.

- `src/app/api/setup/initialize/route.ts`
  - Termina onboarding solo si se cumplen condiciones comerciales.

- `src/app/api/webhooks/mercadopago/route.ts`
  - Webhook clave para pagos y activaciones.

- `src/app/api/webhooks/paypal/route.ts`
  - Integracion equivalente del lado PayPal.

### Reportes y comparticion

- `src/lib/reports/*`
  - Templates y composicion de reportes.

- `src/app/ver/*`
  - Vistas renderizables/compartibles de tickets, reportes e inventario.

- `src/lib/share-links.ts`
  - Seguridad y expiracion de links compartibles.

- `src/app/x/[code]/route.ts`
  - Resolucion de links compartidos.

## 6. Donde buscar segun el cambio que se quiera hacer

### Cambios de autenticacion o sesiones

Tocar primero:

- `src/lib/auth/core.ts`
- `src/lib/auth/require-auth.ts`
- `src/app/api/auth/*`
- `src/app/api/security/sessions/route.ts`
- `src/proxy.ts`

### Cambios de permisos, sucursal activa o modo global

Tocar primero:

- `src/lib/sucursalScope.ts`
- `src/store/useSucursalStore.ts`
- `src/app/api/sucursal/switch/route.ts`
- `src/proxy.ts`

### Cambios en ventas, caja o POS

Tocar primero:

- `src/app/(system-guard)/(protected)/ventas/*`
- `src/app/api/ventas/route.ts`
- `src/app/api/settings/pos/cajas/*`

### Cambios en stock o inventario

Tocar primero:

- `prisma/schema.prisma`
- `src/app/api/productos/*`
- `src/app/api/ventas/route.ts`
- `src/app/api/consignaciones/route.ts`
- `scripts/sync-stock.ts`

### Cambios en consignaciones y liquidaciones

Tocar primero:

- `src/app/(system-guard)/(protected)/consignaciones/*`
- `src/app/(system-guard)/(protected)/liquidaciones/*`
- `src/app/api/consignaciones/*`
- `src/app/api/liquidaciones/*`
- `src/lib/validators/consignacion.ts`
- `src/lib/validators/liquidacion.ts`

### Cambios en la tienda publica

Tocar primero:

- `src/app/lista/*`
- `src/app/api/public/*`
- `src/lib/public-catalog.ts`
- `src/lib/catalog-cart-pricing.ts`
- `src/lib/storefront-content.ts`
- `src/lib/store-theme-utils.ts`

### Cambios en branding o experiencia visual del storefront

Tocar primero:

- `src/app/(system-guard)/(protected)/settings/branding/*`
- `src/app/(system-guard)/(protected)/settings/tienda/*`
- `src/lib/storefront-content.ts`
- `src/lib/store-theme-utils.ts`
- `src/components/brand-logo.tsx`

### Cambios en suscripciones, onboarding o billing

Tocar primero:

- `src/constants/subscriptions.ts`
- `src/lib/subscriptions/*`
- `src/app/api/setup/*`
- `src/app/api/webhooks/mercadopago/route.ts`
- `src/app/api/webhooks/paypal/route.ts`
- `src/lib/payments/*`
- `prisma/schema.prisma`

### Cambios en notificaciones en tiempo real

Tocar primero:

- `server.ts`
- `src/providers/socket-provider.tsx`
- `src/providers/socket-toaster.tsx`
- `src/lib/notificaciones/*`

### Cambios en reportes PDF o links compartibles

Tocar primero:

- `src/app/ver/*`
- `src/lib/reports/*`
- `src/lib/share-links.ts`
- `src/app/x/[code]/route.ts`

### Cambios en uploads o manejo de archivos

Tocar primero:

- `src/lib/uploads.ts`
- componentes que suben imagenes o comprobantes
- variables de entorno como `UPLOAD_DIR`

## 7. Reglas del negocio y contratos que no conviene romper

### 7.1 Regla de sucursal activa

Gran parte del sistema depende de la sucursal activa resuelta por cookie/header/sesion.

No romper:

- `active_sucursal_id`
- `x-sucursal-id`
- resolucion centralizada de `requireAuth()`

### 7.2 Vista global de admin

La sucursal `0` funciona como vista global para administracion, pero no equivale a una sucursal operativa normal.

No asumir que desde vista global se puede vender, consignar o mover stock sin restricciones.

### 7.3 Integridad de stock

Existe convivencia entre:

- stock por sucursal (`StockSucursal`)
- campos legacy agregados en `Producto`
- sincronizacion por trigger/migracion y ajustes manuales

Modificar stock sin revisar todo el circuito puede introducir desincronizacion.

### 7.4 Caja operativa

Si esta habilitado control de caja, la venta POS no deberia registrarse sin caja/sesion de caja abierta.

### 7.5 Consignaciones con folio secuencial

El folio de consignacion tiene valor operativo y de trazabilidad por cliente.
No cambiar numeracion o criterio sin revisar reportes, remitos y busquedas.

### 7.6 Suscripciones y limites

Los limites por plan no son solo visuales. El backend tambien los hace cumplir.

Ejemplos:

- cantidad de sucursales
- uso de consignaciones
- cantidad de usuarios
- cantidad de productos

### 7.7 Share links seguros

Los links compartibles dependen de:

- hash del codigo
- expiracion
- limite de vistas

No simplificar esto sin revisar seguridad y acceso externo.

### 7.8 Notificaciones deduplicadas

El campo `fingerprint` existe para evitar duplicados. No romper unicidad o criterio de deduplicacion.

### 7.9 Tienda publica condicionada por configuracion

La tienda publica y su checkout dependen de configuraciones de sucursal/branding.
No asumir que catalogo visible implica checkout habilitado.

## 8. Como ejecutar, configurar y mantener el proyecto

### 8.1 Requisitos base

- Node.js
- PostgreSQL
- Variables de entorno completas
- Chromium disponible para Puppeteer en produccion

### 8.2 Variables de entorno criticas

Segun `README.md` y `.env.example`, las mas importantes son:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_COOKIE_NAME`
- `CRON_SECRET`
- `PDF_SECRET`
- `SHARE_LINK_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_BASE_URL`
- `SOCKET_DISPATCH_URL`
- `MP_ACCESS_TOKEN`
- `MP_PUBLIC_KEY`
- `MP_WEBHOOK_SECRET`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_SECRET`
- `PAYPAL_WEBHOOK_ID`
- `PAYPAL_API_URL`
- `RESEND_API_KEY`

### 8.3 Ejecucion local

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run dev
```

### 8.4 Seed

```bash
npm run seed
```

### 8.5 Build y produccion

```bash
npm run build
npm start
```

### 8.6 Consideraciones operativas

- `npm run dev` usa `server.ts`, no `next dev`.
- `npm start` ejecuta migraciones antes de arrancar.
- La app escucha en `0.0.0.0` para cloud.
- Los sockets dependen del servidor custom.
- Los reportes PDF dependen de Puppeteer/Chromium.

### 8.7 Mantenimiento habitual

Revisar y mantener estas zonas:

- `prisma/migrations/`
- `scripts/`
- `src/app/api/cron/`
- `docs/security/`
- webhooks de pago
- configuraciones de branding/tienda/sucursales

## 9. Riesgos, deuda tecnica y rarezas detectadas

### 9.1 Migracion Prisma conflictiva

`package.json` elimina manualmente una entrada de `_prisma_migrations` antes de `build` y `start`.

Eso es una senal clara de deuda tecnica de migraciones no resuelta estructuralmente.

### 9.2 Multiples schemas historicos

En `prisma/` hay varios schemas copiados o versionados manualmente.
La fuente actual de verdad debe seguir siendo `prisma/schema.prisma`.

### 9.3 Doble fuente aparente de stock

El sistema combina modelo legacy, stock por sucursal, trigger DB y scripts correctivos.
Es una zona sensible para bugs de consistencia.

### 9.4 Integracion Andreani parcialmente endurecida

`src/lib/andreaniService.ts` muestra decisiones no totalmente parametrizadas y comentarios de trabajo pendiente.

### 9.5 `apiService.ts` demasiado central

Es una pieza util pero grande, con riesgo de concentracion excesiva de responsabilidades del frontend.

### 9.6 Documentacion dispersa

Hay muchas fuentes documentales en la raiz (`README.md`, `DOCUMENTACION.md`, `TECNICO.md`, `MANUAL_SISTEMA.md`, `docs/`, `DOCUMENTATION/`, `README-DOCUMENTATION.md`).

Eso ayuda, pero tambien puede generar duplicacion o desactualizacion cruzada.

### 9.7 Multi-sucursal no equivale necesariamente a multiempresa robusta

El sistema esta muy orientado a una instalacion por comercio con sucursales internas. No deberia asumirse una arquitectura multi-tenant empresarial completa sin auditar esa capa primero.

## 10. Orden recomendado de lectura para una persona nueva o una IA

Leer primero, en este orden:

1. `README.md`
2. `package.json`
3. `server.ts`
4. `prisma/schema.prisma`
5. `src/lib/auth/require-auth.ts`
6. `src/lib/sucursalScope.ts`
7. `src/app/api/ventas/route.ts`
8. `src/app/api/consignaciones/route.ts`
9. `src/app/api/public/checkout/route.ts`
10. `src/app/api/webhooks/mercadopago/route.ts`
11. `src/app/lista/page.tsx`
12. `src/lib/subscriptions/require-subscription.ts`

## 11. Resumen practico para tocar el sistema sin romperlo

- Si el cambio afecta negocio, revisar primero `prisma/schema.prisma` y la API del dominio.
- Si afecta permisos o visibilidad entre sucursales, revisar `require-auth.ts` y `sucursalScope.ts` antes de tocar UI.
- Si afecta pagos, revisar webhooks y setup ademas del checkout visible.
- Si afecta stock, asumir que hay mas de una capa involucrada.
- Si afecta tiempo real, el cambio probablemente toca `server.ts` y providers cliente.
- Si afecta tienda publica, revisar branding, pricing, checkout y restricciones de configuracion como un conjunto.

## 12. Conclusiones

`consignacion-app` es un producto con bastante mas complejidad que una app CRUD o una tienda aislada. Su valor esta en la integracion entre operaciones internas del comercio, canal online, consignaciones, suscripciones y reporting.

La mejor forma de extenderlo sin generar regresiones es pensar siempre en terminos de **dominio completo**: sucursal, stock, caja, seguridad, suscripcion, reportes y canal publico suelen estar conectados aunque el cambio parezca local.
