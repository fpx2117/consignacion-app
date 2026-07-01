# Guía para Hacer Cambios sin Romper el Sistema

Mapa rápido de "qué archivos tocar primero" según el tipo de cambio, y reglas de negocio/contratos que no conviene romper. Complementa [GUIA_TECNICA_PROYECTO.md](./GUIA_TECNICA_PROYECTO.md) (arquitectura) y [DOCUMENTACION.md](./DOCUMENTACION.md) (modelo de datos y rutas).

## 1) Dónde buscar según el cambio que se quiera hacer

### Cambios de autenticación o sesiones

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

### Cambios en la tienda pública

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
- componentes que suben imágenes o comprobantes
- variables de entorno como `UPLOAD_DIR`

## 2) Reglas del negocio y contratos que no conviene romper

### 2.1 Regla de sucursal activa

Gran parte del sistema depende de la sucursal activa resuelta por cookie/header/sesión.

No romper:

- `active_sucursal_id`
- `x-sucursal-id`
- resolución centralizada de `requireAuth()`

### 2.2 Vista global de admin

La sucursal `0` funciona como vista global para administración, pero no equivale a una sucursal operativa normal.

No asumir que desde vista global se puede vender, consignar o mover stock sin restricciones.

### 2.3 Integridad de stock

Existe convivencia entre:

- stock por sucursal (`StockSucursal`)
- campos legacy agregados en `Producto`
- sincronización por trigger/migración y ajustes manuales

Modificar stock sin revisar todo el circuito puede introducir desincronización.

### 2.4 Caja operativa

Si está habilitado control de caja, la venta POS no debería registrarse sin caja/sesión de caja abierta.

### 2.5 Consignaciones con folio secuencial

El folio de consignación tiene valor operativo y de trazabilidad por cliente.
No cambiar numeración o criterio sin revisar reportes, remitos y búsquedas.

### 2.6 Suscripciones y límites

Los límites por plan no son solo visuales. El backend también los hace cumplir.

Ejemplos:

- cantidad de sucursales
- uso de consignaciones
- cantidad de usuarios
- cantidad de productos

### 2.7 Share links seguros

Los links compartibles dependen de:

- hash del código
- expiración
- límite de vistas

No simplificar esto sin revisar seguridad y acceso externo.

### 2.8 Notificaciones deduplicadas

El campo `fingerprint` existe para evitar duplicados. No romper unicidad o criterio de deduplicación.

### 2.9 Tienda pública condicionada por configuración

La tienda pública y su checkout dependen de configuraciones de sucursal/branding.
No asumir que catálogo visible implica checkout habilitado.
