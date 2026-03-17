# 📁 Estructura Completa del Proyecto

**Proyecto:** Consignación App
**Fecha:** 16 de Marzo de 2026
**Total Archivos:** 400+
**Total Directorios:** 225+
**Versión:** 1.1 (Actualizado por JARVIS - Orquestador SDD)

---

## 📊 Resumen de Estructura

```mermaid
graph TD
    A[consignacion-app/] --> B[📄 Archivos de Configuración]
    A --> C[📁 prisma/]
    A --> D[📁 src/]
    A --> E[📁 public/]
    A --> F[📁 DOCUMENTATION/]
    A --> G[📁 .next/ (generated)]

    D --> DA[📁 app/ (200+ archivos)]
    D --> DB[📁 components/ (100+ archivos)]
    D --> DC[📁 lib/ (50+ archivos)]
    D --> DD[📁 store/ (5 archivos)]
    D --> DE[📁 hooks/ (10 archivos)]
    D --> DF[📁 providers/ (5 archivos)]
    D --> DG[📁 constants/ (5 archivos)]
```

> **Nota:** Diagrama Mermaid para visualización interactiva.

---

## 📄 Archivos de Configuración Raíz

| Archivo | Propósito |
|---------|-----------|
| `package.json` | Dependencias y scripts |
| `tsconfig.json` | Configuración TypeScript |
| `next.config.js` | Configuración Next.js |
| `tailwind.config.ts` | Configuración Tailwind CSS |
| `postcss.config.js` | Configuración PostCSS |
| `.eslintrc.json` | Reglas ESLint |
| `.env` | Variables de entorno (NO commit) |
| `.env.example` | Template de variables |
| `.gitignore` | Archivos ignorados |
| `README.md` | Documentación proyecto |

---

## 📁 prisma/

```
prisma/
├── schema.prisma          # Modelo de datos (856 líneas)
├── seed.ts                # Datos de prueba
└── migrations/            # Migraciones generadas
```

**Models en schema.prisma (30+):**
1. Configuracion
2. Usuario
3. UserSession
4. AuditLog
5. HorarioLaboral
6. Cliente
7. Branding
8. Sucursal
9. Plan
10. PlanLimits
11. Subscription
12. SubscriptionHistory
13. Producto
14. Categoria
15. Subcategoria
16. Inventario
17. Venta
18. VentaDetalle
19. Pago
20. Consignacion
21. ConsignacionDetalle
22. Gasto
23. GastoCategoria
24. PedidoEsperado
25. Liquidacion
26. Notificacion
27. EstadoCuentaCliente
28. TemaPersonalizado
29. HorarioTienda
30. ... y más

---

## 📁 src/app/ (App Router - Next.js 16)

### 📁 (system-guard) - Layouts de Protección

> **Estructura de rutas protegidas con Next.js App Router.**

#### 🔒 Rutas Autenticadas

| Ruta | Descripción | Archivos | Líneas Aprox. |
|------|-------------|----------|----------------|
| `/(system-guard)/(protected)/layout.tsx` | Layout principal protegido | 1 | 50 |
| `/(system-guard)/(protected)/dashboard/page.tsx` | Dashboard principal | 1 | 200 |
| `/(system-guard)/(protected)/settings/page.tsx` | Configuración general | 1 | 300 |
| `/(system-guard)/(protected)/settings/general/page.tsx` | Configuración general | 1 | 150 |
| `/(system-guard)/(protected)/settings/pos/page.tsx` | Configuración POS | 1 | 250 |
| `/(system-guard)/(protected)/settings/pos/horarios/page.tsx` | Horarios POS | 1 | 180 |
| `/(system-guard)/(protected)/settings/tienda/page.tsx` | Configuración tienda | 1 | 200 |
| `/(system-guard)/(protected)/settings/subscriptions/page.tsx` | Gestión de planes | 1 | 400 |
| `/(system-guard)/(protected)/settings/subscriptions/components/SubscriptionStatusCard.tsx` | Componente de estado | 1 | 300 |
| `/(system-guard)/(protected)/settings/branches/page.tsx` | Gestión de sucursales | 1 | 250 |
| `/(system-guard)/(protected)/settings/branding/page.tsx` | Branding | 1 | 200 |
| `/(system-guard)/(protected)/settings/security/page.tsx` | Seguridad | 1 | 300 |
| `/(system-guard)/(protected)/settings/security/employees/page.tsx` | Empleados | 1 | 250 |
| `/(system-guard)/(protected)/settings/security/sessions/page.tsx` | Sesiones activas | 1 | 200 |
| `/(system-guard)/(protected)/settings/security/activity/page.tsx` | Actividad recent | 1 | 350 |
| `/(system-guard)/(protected)/settings/notifications/page.tsx` | Notificaciones | 1 | 200 |
| `/(system-guard)/(protected)/settings/whatsapp/page.tsx` | Configuración WhatsApp | 1 | 180 |

#### 📋 Rutas de Recursos

| Ruta | Descripción | Archivos | Líneas Aprox. |
|------|-------------|----------|----------------|
| `/(system-guard)/(protected)/clientes/page.tsx` | Lista de clientes | 1 | 250 |
| `/(system-guard)/(protected)/clientes/[id]/page.tsx` | Detalle cliente | 1 | 300 |
| `/(system-guard)/(protected)/productos/page.tsx` | Catálogo de productos | 1 | 400 |
| `/(system-guard)/(protected)/productos/[id]/page.tsx` | Detalle producto | 1 | 250 |
| `/(system-guard)/(protected)/ventas/page.tsx` | Historial de ventas | 1 | 350 |
| `/(system-guard)/(protected)/ventas/[id]/page.tsx` | Detalle venta | 1 | 400 |
| `/(system-guard)/(protected)/ventas/nueva/page.tsx` | Nueva venta (POS) | 1 | 500 |
| `/(system-guard)/(protected)/consignaciones/page.tsx` | Lista de consignaciones | 1 | 300 |
| `/(system-guard)/(protected)/consignaciones/[id]/page.tsx` | Detalle consignación | 1 | 450 |
| `/(system-guard)/(protected)/consignaciones/nueva/page.tsx` | Nueva consignación | 1 | 400 |
| `/(system-guard)/(protected)/pedidos-esperados/page.tsx` | Lista de pedidos | 1 | 250 |
| `/(system-guard)/(protected)/pedidos-esperados/[id]/page.tsx` | Detalle pedido | 1 | 300 |
| `/(system-guard)/(protected)/gastos/page.tsx` | Lista de gastos | 1 | 300 |
| `/(system-guard)/(protected)/gastos/[id]/page.tsx` | Detalle gasto | 1 | 400 |
| `/(system-guard)/(protected)/liquidaciones/[id]/page.tsx` | Detalle liquidación | 1 | 350 |

#### 📊 Rutas de Reportes (PDF)

| Ruta | Descripción | Archivos | Líneas Aprox. |
|------|-------------|----------|----------------|
| `/(system-guard)/(protected)/ver/consig/[period]/page.tsx` | Reporte consignaciones | 1 | 200 |
| `/(system-guard)/(protected)/ver/consig/[period]/pdf/page.tsx` | PDF consignaciones | 1 | 150 |
| `/(system-guard)/(protected)/ver/dashboard/[period]/page.tsx` | Reporte dashboard | 1 | 250 |
| `/(system-guard)/(protected)/ver/dashboard/[period]/pdf/page.tsx` | PDF dashboard | 1 | 180 |
| `/(system-guard)/(protected)/ver/pos/[period]/page.tsx` | Reporte POS | 1 | 300 |
| `/(system-guard)/(protected)/ver/pos/[period]/pdf/page.tsx` | PDF POS | 1 | 200 |

> **Nota:** Las rutas de reportes generan PDFs dinámicos con datos consolidados.


### 📁 api/ - Endpoints REST

> **API principal del sistema, basada en Next.js App Router.**

#### 🔐 Autenticación y Seguridad

| Método | Endpoint | Descripción | Archivo | Líneas Aprox. |
|--------|----------|-------------|---------|----------------|
| POST | `/api/auth/login` | Iniciar sesión | `login/route.ts` | 100 |
| POST | `/api/auth/logout` | Cerrar sesión | `logout/route.ts` | 50 |
| GET | `/api/auth/me` | Datos del usuario autenticado | `me/route.ts` | 80 |
| POST | `/api/auth/forgot-password` | Recuperación de contraseña | `forgot-password/route.ts` | 120 |
| POST | `/api/auth/reset-password` | Restablecer contraseña | `reset-password/route.ts` | 90 |
| POST | `/api/auth/setup-auth` | Configuración inicial de autenticación | `setup-auth/route.ts` | 70 |

#### 🏢 Gestión de Sucursales

| Método | Endpoint | Descripción | Archivo | Líneas Aprox. |
|--------|----------|-------------|---------|----------------|
| POST | `/api/sucursal/switch` | Cambiar sucursal activa (NUEVO) | `sucursal/switch/route.ts` | 62 |

#### 📋 Suscripciones y Planes

| Método | Endpoint | Descripción | Archivo | Líneas Aprox. |
|--------|----------|-------------|---------|----------------|
| GET | `/api/subscriptions/current` | Obtener suscripción actual | `subscriptions/current/route.ts` | 80 |
| GET | `/api/subscriptions/plans` | Listar planes disponibles | `subscriptions/plans/route.ts` | 120 |
| POST | `/api/subscriptions/cancel` | Cancelar suscripción | `subscriptions/cancel/route.ts` | 70 |
| POST | `/api/subscriptions/mercadopago/create` | Crear suscripción con MercadoPago | `subscriptions/mercadopago/create/route.ts` | 150 |
| POST | `/api/subscriptions/paypal/create` | Crear suscripción con PayPal | `subscriptions/paypal/create/route.ts` | 140 |
| POST | `/api/subscriptions/promo/redeem` | Canjear código promo | `subscriptions/promo/redeem/route.ts` | 90 |

#### 👥 Clientes

| Método | Endpoint | Descripción | Archivo | Líneas Aprox. |
|--------|----------|-------------|---------|----------------|
| GET/POST | `/api/clientes` | Listar/Crear cliente | `clientes/route.ts` | 200 |
| GET/PUT/DELETE | `/api/clientes/:id` | CRUD cliente | `clientes/[id]/route.ts` | 180 |
| GET | `/api/clientes/:id/estado-cuenta` | Estado de cuenta del cliente | `clientes/[id]/estado-cuenta/route.ts` | 90 |
| GET | `/api/clientes/:id/pagos` | Pagos del cliente | `clientes/[id]/pagos/route.ts` | 120 |

#### 🛒 Ventas

| Método | Endpoint | Descripción | Archivo | Líneas Aprox. |
|--------|----------|-------------|---------|----------------|
| GET/POST | `/api/ventas` | Listar/Crear venta | `ventas/route.ts` | 250 |
| GET/PUT/DELETE | `/api/ventas/:id` | CRUD venta | `ventas/[id]/route.ts` | 180 |
| GET | `/api/ventas/:id/ticket-link` | Link de ticket de venta | `ventas/[id]/ticket-link/route.ts` | 70 |

#### 📦 Consignaciones

| Método | Endpoint | Descripción | Archivo | Líneas Aprox. |
|--------|----------|-------------|---------|----------------|
| GET/POST | `/api/consignaciones` | Listar/Crear consignación | `consignaciones/route.ts` | 200 |
| GET/PUT/DELETE | `/api/consignaciones/:id` | CRUD consignación | `consignaciones/[id]/route.ts` | 180 |
| GET | `/api/consignaciones/:id/remito-link` | Link de remito | `consignaciones/[id]/remito-link/route.ts` | 70 |

#### 📦 Productos

| Método | Endpoint | Descripción | Archivo | Líneas Aprox. |
|--------|----------|-------------|---------|----------------|
| GET/POST | `/api/productos` | Listar/Crear producto | `productos/route.ts` | 200 |
| GET/PUT/DELETE | `/api/productos/:id` | CRUD producto | `productos/[id]/route.ts` | 180 |
| GET | `/api/productos/barcode/:code` | Buscar producto por barcode | `productos/barcode/[code]/route.ts` | 90 |

#### 💳 Pagos

| Método | Endpoint | Descripción | Archivo | Líneas Aprox. |
|--------|----------|-------------|---------|----------------|
| GET/POST | `/api/pagos` | Listar/Crear pago | `pagos/route.ts` | 150 |
| GET | `/api/pagos/:clienteId` | Pagos de un cliente | `pagos/[clienteId]/route.ts` | 90 |

#### 💰 Gastos

| Método | Endpoint | Descripción | Archivo | Líneas Aprox. |
|--------|----------|-------------|---------|----------------|
| GET/POST | `/api/gastos` | Listar/Crear gasto | `gastos/route.ts` | 200 |
| GET/PUT/DELETE | `/api/gastos/:id` | CRUD gasto | `gastos/[id]/route.ts` | 180 |
| GET | `/api/gastos/:id/comprobante-link` | Link de comprobante | `gastos/[id]/comprobante-link/route.ts` | 70 |
| GET/POST | `/api/gastos/categorias` | Listar/Crear categoría de gasto | `gastos/categorias/route.ts` | 120 |
| GET/PUT/DELETE | `/api/gastos/categorias/:id` | CRUD categoría de gasto | `gastos/categorias/[id]/route.ts` | 90 |

#### ⚙️ Configuración del Sistema

| Método | Endpoint | Descripción | Archivo | Líneas Aprox. |
|--------|----------|-------------|---------|----------------|
| GET/POST | `/api/settings/general` | Configuración general | `settings/general/route.ts` | 150 |
| GET/POST | `/api/settings/branding` | Configuración de branding | `settings/branding/route.ts` | 200 |
| GET | `/api/settings/branding/logo` | Obtener logo | `settings/branding/logo/route.ts` | 50 |
| POST | `/api/settings/branding/logo/upload` | Subir logo | `settings/branding/logo/upload/route.ts` | 80 |
| GET/POST | `/api/settings/sucursales` | Listar/Crear sucursal | `settings/sucursales/route.ts` | 250 |
| GET/PUT/DELETE | `/api/settings/sucursales/:id` | CRUD sucursal | `settings/sucursales/[id]/route.ts` | 180 |
| GET/POST | `/api/settings/users` | Listar/Crear usuario | `settings/users/route.ts` | 200 |
| GET | `/api/settings/pos/cajas` | Cajas abiertas | `settings/pos/cajas/route.ts` | 100 |
| POST | `/api/settings/pos/cajas/cerrar` | Cerrar caja | `settings/pos/cajas/cerrar/route.ts` | 70 |
| GET/POST | `/api/settings/pos/horarios` | Horarios POS | `settings/pos/horarios/route.ts` | 150 |

#### 📊 Dashboard y KPIs

| Método | Endpoint | Descripción | Archivo | Líneas Aprox. |
|--------|----------|-------------|---------|----------------|
| GET | `/api/dashboard/kpi` | KPIs del dashboard | `dashboard/kpi/route.ts` | 120 |
| GET | `/api/dashboard/tendencia` | Tendencias de ventas | `dashboard/tendencia/route.ts` | 90 |
| GET | `/api/dashboard/top-productos` | Top productos | `dashboard/top-productos/route.ts` | 80 |
| GET | `/api/dashboard/consignaciones` | Consignaciones | `dashboard/consignaciones/route.ts` | 100 |
| GET | `/api/dashboard/reporte-link` | Link de reporte | `dashboard/reporte-link/route.ts` | 70 |

#### ⏰ Tareas Programadas (Cron)

| Método | Endpoint | Descripción | Archivo | Líneas Aprox. |
|--------|----------|-------------|---------|----------------|
| GET | `/api/cron/check-subscriptions` | Verificar suscripciones vencidas | `cron/check-subscriptions/route.ts` | 100 |
| GET | `/api/cron/check-vencimientos` | Verificar vencimientos | `cron/check-vencimientos/route.ts` | 80 |
| GET | `/api/cron/consignaciones` | Procesar consignaciones | `cron/consignaciones/route.ts` | 90 |
| GET | `/api/cron/update-subscription-prices` | Actualizar precios de suscripción | `cron/update-subscription-prices/route.ts` | 120 |

#### 🔗 Webhooks (Eventos Externos)

| Método | Endpoint | Descripción | Archivo | Líneas Aprox. |
|--------|----------|-------------|---------|----------------|
| POST | `/api/webhooks/mercadopago` | Webhook de MercadoPago | `webhooks/mercadopago/route.ts` | 150 |
| POST | `/api/webhooks/paypal` | Webhook de PayPal | `webhooks/paypal/route.ts` | 140 |

#### 🛠️ Admin y Migraciones

| Método | Endpoint | Descripción | Archivo | Líneas Aprox. |
|--------|----------|-------------|---------|----------------|
| GET/POST | `/api/admin/timezone-migration` | Migración de timezone | `admin/timezone-migration/route.ts` | 100 |

#### 🔒 Seguridad y Sesiones

| Método | Endpoint | Descripción | Archivo | Líneas Aprox. |
|--------|----------|-------------|---------|----------------|
| GET | `/api/security/activity` | Actividad recent | `security/activity/route.ts` | 120 |
| GET | `/api/security/sessions` | Sesiones activas | `security/sessions/route.ts` | 90 |

#### 🚀 Configuración Inicial (Setup)

| Método | Endpoint | Descripción | Archivo | Líneas Aprox. |
|--------|----------|-------------|---------|----------------|
| POST | `/api/setup/initialize` | Inicializar sistema | `setup/initialize/route.ts` | 150 |
| GET | `/api/setup/status` | Estado de setup | `setup/status/route.ts` | 60 |
| POST | `/api/setup/create-mp-subscription` | Crear suscripción MP | `setup/create-mp-subscription/route.ts` | 200 |
| POST | `/api/setup/create-paypal` | Configurar PayPal | `setup/create-paypal/route.ts` | 180 |
| POST | `/api/setup/create-preference` | Crear preferencia de pago | `setup/create-preference/route.ts` | 150 |

#### 🌐 API Pública (Frontend)

| Método | Endpoint | Descripción | Archivo | Líneas Aprox. |
|--------|----------|-------------|---------|----------------|
| GET | `/api/public/branding-media` | Medios de branding | `public/branding-media/route.ts` | 80 |
| POST | `/api/public/checkout` | Checkout público | `public/checkout/route.ts` | 200 |
| GET | `/api/public/checkout/status` | Estado del checkout | `public/checkout/status/route.ts` | 90 |
| POST | `/api/public/envios/cotizar` | Cotización de envíos | `public/envios/cotizar/route.ts` | 150 |
| GET | `/api/public/lista-precios` | Lista de precios pública | `public/lista-precios/route.ts` | 70 |

#### 🔔 Notificaciones

| Método | Endpoint | Descripción | Archivo | Líneas Aprox. |
|--------|----------|-------------|---------|----------------|
| GET | `/api/notificaciones` | Listar notificaciones | `notificaciones/route.ts` | 120 |
| POST | `/api/notificaciones/:id/read` | Marcar como leída | `notificaciones/[id]/read/route.ts` | 70 |
| POST | `/api/notificaciones/create` | Crear notificación | `notificaciones/create/route.ts` | 100 |
| POST | `/api/notificaciones/read-all` | Marcar todas como leídas | `notificaciones/read-all/route.ts` | 60 |

#### 📁 Files (Almacenamiento)

| Método | Endpoint | Descripción | Archivo | Líneas Aprox. |
|--------|----------|-------------|---------|----------------|
| GET | `/api/files/...` | Servir archivos | `files/[...path]/route.ts` | 50 |

#### 📤 Upload (Subidas)

| Método | Endpoint | Descripción | Archivo | Líneas Aprox. |
|--------|----------|-------------|---------|----------------|
| POST | `/api/upload` | Subir archivos | `upload/route.ts` | 100 |

> **Total API Routes:** 60+ endpoints (30,000+ líneas de código)

**Características clave:**
- ✅ Basada en Next.js App Router
- ✅ Endpoints modulares por funcionalidad
- ✅ Validación centralizada con Zod
- ✅ Middlewares de autenticación y autorización
- ✅ Integración con MercadoPago, PayPal, Webhooks
- ✅ Soporte para PDFs dinámicos (tickets, reportes)


---

## 📁 src/components/

### 🔒 Guards

| Componente | Archivo | Líneas | Propósito |
|------------|---------|--------|-----------|
| SubscriptionGuard | `SubscriptionGuard.tsx` | 32 | Verifica plan activo |
| GlobalReadonlyGuard | `global-readonly-guard.tsx` | 65 | Bloquea UI en vista global |

### 📊 Layouts UI

| Componente | Archivo | Líneas | Propósito |
|------------|---------|--------|-----------|
| SidebarDock | `sidebar-dock.tsx` | 300+ | Sidebar lateral |
| TopBar | `top-bar.tsx` | 150+ | Barra superior |
| DesktopSummary | `desktop-summary.tsx` | 200+ | Resumen desktop POS |

### 🔔 Notificaciones

| Componente | Archivo | Propósito |
|------------|---------|-----------|
| Toaster | `toaster.tsx` | Toast notifications |
| NotificationBell | `notification-bell.tsx` | Campana de notificaciones |

### 📝 Formularios

| Componente | Archivo | Propósito |
|------------|---------|-----------|
| ProductForm | `product-form.tsx` | Formulario de productos |
| ClientForm | `client-form.tsx` | Formulario de clientes |
| SaleForm | `sale-form.tsx` | Formulario de ventas |

### 📋 Tablas

| Componente | Archivo | Propósito |
|------------|---------|-----------|
| ProductsTable | `products-table.tsx` | Tabla de productos |
| ClientsTable | `clients-table.tsx` | Tabla de clientes |
| SalesTable | `sales-table.tsx` | Tabla de ventas |

### 🎨 UI Elements (shadcn/ui)

```
src/components/ui/
├── button.tsx
├── card.tsx
├── input.tsx
├── label.tsx
├── select.tsx
├── dropdown-menu.tsx
├── dialog.tsx
├── table.tsx
├── tabs.tsx
├── toast.tsx
└── ... (30+ componentes)
```

**Total Components:** 100+ archivos

---

## 📁 src/lib/

### 🔐 Autenticación

```
src/lib/auth/
├── require-auth.ts          # Guard server-side (107 líneas)
├── core.ts                  # JWT y cookies
├── session.ts               # Gestión de sesiones
└── permissions.ts           # Verificación de permisos
```

### 📦 Suscripciones

```
src/lib/subscriptions/
├── require-subscription.ts  # Lógica de planes y límites
├── limits.ts                # Validación de límites
└── plans.ts                 # Datos de planes
```

### 🎨 Utilidades

```
src/lib/
├── broadcast-channel.ts     # Channel API (NUEVO - 60 líneas)
├── apiService.ts            # Cliente API (783 líneas)
├── sucursalScope.ts         # Scope por sucursal
├── utils.ts                 # Utilidades generales
├── date.ts                  # Manejo de fechas
├── pdf.ts                   # Generación de PDFs
├── notifications.ts         # Notificaciones
├── audit.ts                 # Auditoría
├── security/
│   └── session-hash.ts      # Hash de sesión
├── clientData.ts            # Datos del cliente (IP, UA)
└── ... (más utilidades)
```

**Total lib:** 50+ archivos

---

## 📁 src/store/

```
src/store/
├── useSucursalStore.ts      # Store de sucursal (71 líneas, SIN persist)
└── ... (otros stores)
```

**Características:**
- ✅ Zustand sin persist
- ✅ Hidratado desde SSR
- ✅ BroadcastChannel integrado

---

## 📁 src/hooks/

```
src/hooks/
├── useBroadcastChannel.ts   # Hook para BroadcastChannel (NUEVO - 44 líneas)
└── ... (otros hooks)
```

**Total hooks:** 10 archivos

---

## 📁 src/providers/

```
src/providers/
├── SocketProvider.tsx       # Conexión Socket.io
├── ThemeProvider.tsx        # Tema claro/oscuro
└── ... (otros providers)
```

**Total providers:** 5 archivos

---

## 📁 src/constants/

```
src/constants/
├── subscriptions.ts         # Planes y límites
└── ... (otros constants)
```

---

## 📁 public/

```
public/
├── logo.png
├── favicon.ico
└── ... (assets estáticos)
```

---

## 📁 DOCUMENTATION/

```
DOCUMENTATION/
├── PROYECTO-MAESTRO.md              # Documento maestro (este)
├── FLOW-DETECCION-SUCURSAL-PAQUETES.md  # Flujos de sucursal
└── ESTRUCTURA-COMPLETA.md           # Estructura del proyecto
```

---

## 📊 Estadísticas por Categoría

| Categoría | Archivos | Líneas Aprox. |
|-----------|----------|---------------|
| **Configuración** | 10 | 500 |
| **Prisma (DB)** | 3 | 1,000 |
| **App Router** | 200+ | 15,000 |
| **Components UI** | 100+ | 8,000 |
| **Librerías (lib)** | 50+ | 3,000 |
| **Stores** | 5 | 500 |
| **Hooks** | 10 | 300 |
| **Providers** | 5 | 200 |
| **Constants** | 5 | 100 |
| **TOTAL** | **400+** | **~30,000** |

---

## 🔑 Archivos Clave del Rediseño Reciente

### 🆕 Nuevos (Fase 1)

| Archivo | Líneas | Propósito |
|---------|--------|-----------|
| `src/lib/broadcast-channel.ts` | 60 | Channel API con fallback |
| `src/hooks/useBroadcastChannel.ts` | 44 | Hook React para mensajes |
| `src/app/api/sucursal/switch/route.ts` | 62 | POST /api/sucursal/switch |

### ✏️ Modificados (Rediseño Sucursal)

| Archivo | Cambios | Propósito |
|---------|---------|-----------|
| `src/store/useSucursalStore.ts` | +116/-116 | Store sin persist, hydrate() |
| `src/lib/auth/require-auth.ts` | +18/-18 | Solo cookie para ADMIN |
| `src/components/SubscriptionGuard.tsx` | +74/-74 | Recibe planLimits como prop |
| `src/components/sidebar-dock.tsx` | +28/-28 | hydrate() + BroadcastChannel |
| `src/components/top-bar.tsx` | +40/-40 | switchSucursal async |

---

## 🚀 Comandos de Referencia

### 📋 Ver Estructura

```bash
# Ver todos los archivos
find src -type f | wc -l

# Ver todos los directorios
find src -type d | wc -l

# Ver archivos por extensión
find src -name "*.tsx" | wc -l
find src -name "*.ts" | wc -l

# Ver API Routes
find src/app/api -name "route.ts" | wc -l
```

### 🔍 Buscar en Código

```bash
# Buscar texto en archivos
grep -r "useSucursalStore" src/

# Buscar imports rotos
grep -r "setActiveSucursalId" src/

# Ver archivos modificados recientemente
find src -type f -mtime -1
```

### 🛠️ Mantenimiento

```bash
# Limpiar .next
rm -rf .next

# Regenerar Prisma
npx prisma generate

# Verificar TypeScript
npx tsc --noEmit

# Lintear código
npm run lint
```

---

## 📚 Índice de Documentación

| Documento | Descripción |
|-----------|-------------|
| `PROYECTO-MAESTRO.md` | Visión general del proyecto |
| `FLOW-DETECCION-SUCURSAL-PAQUETES.md` | Flujos de sucursal y planes |
| `ESTRUCTURA-COMPLETA.md` | Este documento - estructura detallada |

---

**Fin de Documentación** ✅

*Documento generado por JARVIS (Orquestador SDD) - 15/03/2026*