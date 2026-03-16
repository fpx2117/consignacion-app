# 📁 Estructura Completa del Proyecto

**Proyecto:** Consignación App  
**Fecha:** 15 de Marzo de 2026  
**Total Archivos:** 400+  
**Total Directorios:** 225+

---

## 📊 Resumen de Estructura

```
consignacion-app/
├── 📄 Archivos de Configuración (10)
├── 📁 prisma/ (3 archivos)
├── 📁 src/
│   ├── 📁 app/ (200+ archivos)
│   ├── 📁 components/ (100+ archivos)
│   ├── 📁 lib/ (50+ archivos)
│   ├── 📁 store/ (5 archivos)
│   ├── 📁 hooks/ (10 archivos)
│   ├── 📁 providers/ (5 archivos)
│   └── 📁 constants/ (5 archivos)
├── 📁 public/
├── 📁 DOCUMENTATION/
└── 📁 .next/ (generated)
```

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

```
src/app/(system-guard)/
├── (protected)/              # Rutas autenticadas
│   ├── layout.tsx           # Layout principal protegido
│   ├── dashboard/
│   │   ├── page.tsx         # Dashboard principal
│   │   └── components/
│   ├── settings/
│   │   ├── page.tsx         # Configuración general
│   │   ├── general/
│   │   │   └── page.tsx
│   │   ├── pos/
│   │   │   ├── page.tsx     # Configuración POS
│   │   │   └── horarios/
│   │   │       └── page.tsx
│   │   ├── tienda/
│   │   │   └── page.tsx
│   │   ├── subscriptions/
│   │   │   ├── page.tsx     # Gestión de planes
│   │   │   └── components/
│   │   │       └── SubscriptionStatusCard.tsx
│   │   ├── branches/
│   │   │   └── page.tsx
│   │   ├── branding/
│   │   │   └── page.tsx
│   │   ├── security/
│   │   │   ├── page.tsx
│   │   │   ├── employees/
│   │   │   │   └── page.tsx
│   │   │   ├── sessions/
│   │   │   │   └── page.tsx
│   │   │   └── activity/
│   │   │       └── page.tsx
│   │   ├── notifications/
│   │   │   └── page.tsx
│   │   └── whatsapp/
│   │       └── page.tsx
│   ├── clientes/
│   │   ├── page.tsx         # Lista de clientes
│   │   └── [id]/
│   │       └── page.tsx     #Detalle cliente
│   ├── productos/
│   │   ├── page.tsx         # Catálogo de productos
│   │   └── [id]/
│   │       └── page.tsx
│   ├── ventas/
│   │   ├── page.tsx         # Historial de ventas
│   │   └── [id]/
│   │       └── page.tsx     # Detalle venta
│   │   └── nueva/
│   │       └── page.tsx     # Nueva venta (POS)
│   ├── consignaciones/
│   │   ├── page.tsx         # Lista de consignaciones
│   │   └── [id]/
│   │       └── page.tsx     # Detalle consignación
│   │   └── nueva/
│   │       └── page.tsx     # Nueva consignación
│   ├── pedidos-esperados/
│   │   ├── page.tsx         # Lista de pedidos
│   │   └── [id]/
│   │       └── page.tsx     # Detalle pedido
│   ├── gastos/
│   │   ├── page.tsx         # Lista de gastos
│   │   └── [id]/
│   │       └── page.tsx     # Detalle gasto
│   ├── liquidaciones/
│   │   └── [id]/
│   │       └── page.tsx     # Detalle liquidación
│   ├── caja/
│   │   ├── abrir/
│   │   │   └── page.tsx     # Abrir caja
│   │   ├── cerrar/
│   │   │   └── page.tsx     # Cerrar caja
│   │   └── historial/
│   │       └── page.tsx     # Historial de caja
│   └── ver/
│       ├── consig/
│       │   └── [period]/
│       │       ├── page.tsx  # Reporte consignaciones
│       │       └── pdf/
│       │           └── page.tsx
│       ├── dashboard/
│       │   └── [period]/
│       │       ├── page.tsx  # Reporte dashboard
│       │       └── pdf/
│       │           └── page.tsx
│       ├── pos/
│       │   └── [period]/
│       │       ├── page.tsx  # Reporte POS
│       │       └── pdf/
│       │           └── page.tsx
│       └── ... (más reportes PDF)
```

### 📁 api/ - Endpoints REST

```
src/app/api/
├── 📁 auth/
│   ├── login/route.ts               # POST /api/auth/login
│   ├── logout/route.ts              # POST /api/auth/logout
│   ├── me/route.ts                  # GET /api/auth/me
│   ├── forgot-password/route.ts     # POST /api/auth/forgot-password
│   ├── reset-password/route.ts      # POST /api/auth/reset-password
│   └── setup-auth/route.ts          # POST /api/auth/setup-auth
│
├── 📁 sucursal/
│   └── switch/route.ts              # POST /api/sucursal/switch (NUEVO)
│
├── 📁 subscriptions/
│   ├── current/route.ts             # GET /api/subscriptions/current
│   ├── plans/route.ts               # GET /api/subscriptions/plans
│   ├── cancel/route.ts              # POST /api/subscriptions/cancel
│   ├── mercadopago/
│   │   └── create/route.ts          # POST /api/subscriptions/mercadopago/create
│   ├── paypal/
│   │   └── create/route.ts          # POST /api/subscriptions/paypal/create
│   └── promo/
│       └── redeem/route.ts          # POST /api/subscriptions/promo/redeem
│
├── 📁 clientes/
│   ├── route.ts                     # GET/POST /api/clientes
│   ├── [id]/
│   │   ├── route.ts                 # GET/PUT/DELETE /api/clientes/:id
│   │   ├── estado-cuenta/
│   │   │   └── route.ts             # GET /api/clientes/:id/estado-cuenta
│   │   └── pagos/
│   │       └── route.ts             # GET /api/clientes/:id/pagos
│
├── 📁 ventas/
│   ├── route.ts                     # GET/POST /api/ventas
│   ├── [id]/
│   │   ├── route.ts                 # GET/PUT/DELETE /api/ventas/:id
│   │   └── ticket-link/
│   │       └── route.ts             # GET /api/ventas/:id/ticket-link
│
├── 📁 consignaciones/
│   ├── route.ts                     # GET/POST /api/consignaciones
│   ├── [id]/
│   │   ├── route.ts                 # GET/PUT/DELETE /api/consignaciones/:id
│   │   └── remito-link/
│   │       └── route.ts             # GET /api/consignaciones/:id/remito-link
│
├── 📁 productos/
│   ├── route.ts                     # GET/POST /api/productos
│   ├── [id]/
│   │   └── route.ts                 # GET/PUT/DELETE /api/productos/:id
│   └── barcode/
│       └── [code]/
│           └── route.ts             # GET /api/productos/barcode/:code
│
├── 📁 pagos/
│   ├── route.ts                     # GET/POST /api/pagos
│   └── [clienteId]/
│       └── route.ts                 # GET /api/pagos/:clienteId
│
├── 📁 gastos/
│   ├── route.ts                     # GET/POST /api/gastos
│   ├── [id]/
│   │   ├── route.ts                 # GET/PUT/DELETE /api/gastos/:id
│   │   └── comprobante-link/
│   │       └── route.ts             # GET /api/gastos/:id/comprobante-link
│   └── categorias/
│       ├── route.ts                 # GET/POST /api/gastos/categorias
│       └── [id]/
│           └── route.ts             # GET/PUT/DELETE /api/gastos/categorias/:id
│
├── 📁 settings/
│   ├── general/
│   │   └── route.ts                 # GET/POST /api/settings/general
│   ├── branding/
│   │   ├── route.ts                 # GET/POST /api/settings/branding
│   │   └── logo/
│   │       ├── route.ts             # GET /api/settings/branding/logo
│   │       └── upload/
│   │           └── route.ts         # POST /api/settings/branding/logo/upload
│   ├── sucursales/
│   │   ├── route.ts                 # GET/POST /api/settings/sucursales
│   │   └── [id]/
│   │       └── route.ts             # GET/PUT/DELETE /api/settings/sucursales/:id
│   ├── users/
│   │   └── route.ts                 # GET/POST /api/settings/users
│   └── pos/
│       ├── cajas/
│       │   ├── route.ts             # GET /api/settings/pos/cajas
│       │   └── cerrar/
│       │       └── route.ts         # POST /api/settings/pos/cajas/cerrar
│       └── horarios/
│           └── route.ts             # GET/POST /api/settings/pos/horarios
│
├── 📁 dashboard/
│   ├── kpi/
│   │   └── route.ts                 # GET /api/dashboard/kpi
│   ├── tendencia/
│   │   └── route.ts                 # GET /api/dashboard/tendencia
│   ├── top-productos/
│   │   └── route.ts                 # GET /api/dashboard/top-productos
│   ├── consignaciones/
│   │   └── route.ts                 # GET /api/dashboard/consignaciones
│   └── reporte-link/
│       └── route.ts                 # GET /api/dashboard/reporte-link
│
├── 📁 cron/
│   ├── check-subscriptions/
│   │   └── route.ts                 # GET /api/cron/check-subscriptions
│   ├── check-vencimientos/
│   │   └── route.ts                 # GET /api/cron/check-vencimientos
│   ├── consignaciones/
│   │   └── route.ts                 # GET /api/cron/consignaciones
│   └── update-subscription-prices/
│       └── route.ts                 # GET /api/cron/update-subscription-prices
│
├── 📁 webhooks/
│   ├── mercadopago/
│   │   └── route.ts                 # POST /api/webhooks/mercadopago
│   └── paypal/
│       └── route.ts                 # POST /api/webhooks/paypal
│
├── 📁 admin/
│   └── timezone-migration/
│       └── route.ts                 # GET/POST /api/admin/timezone-migration
│
├── 📁 security/
│   ├── activity/
│   │   └── route.ts                 # GET /api/security/activity
│   └── sessions/
│       └── route.ts                 # GET /api/security/sessions
│
├── 📁 setup/
│   ├── initialize/
│   │   └── route.ts                 # POST /api/setup/initialize
│   ├── status/
│   │   └── route.ts                 # GET /api/setup/status
│   ├── create-mp-subscription/
│   │   └── route.ts                 # POST /api/setup/create-mp-subscription
│   ├── create-paypal/
│   │   └── route.ts                 # POST /api/setup/create-paypal
│   └── create-preference/
│       └── route.ts                 # POST /api/setup/create-preference
│
├── 📁 public/
│   ├── branding-media/
│   │   └── route.ts                 # GET /api/public/branding-media
│   ├── checkout/
│   │   ├── route.ts                 # POST /api/public/checkout
│   │   └── status/
│   │       └── route.ts             # GET /api/public/checkout/status
│   ├── envios/
│   │   └── cotizar/
│   │       └── route.ts             # POST /api/public/envios/cotizar
│   └── lista-precios/
│       └── route.ts                 # GET /api/public/lista-precios
│
├── 📁 notificaciones/
│   ├── route.ts                     # GET /api/notificaciones
│   ├── [id]/
│   │   └── read/
│   │       └── route.ts             # POST /api/notificaciones/:id/read
│   ├── create/
│   │   └── route.ts                 # POST /api/notificaciones/create
│   └── read-all/
│       └── route.ts                 # POST /api/notificaciones/read-all
│
├── 📁 files/
│   └── [...path]/
│       └── route.ts                 # GET /api/files/...
│
└── 📁 upload/
    └── route.ts                     # POST /api/upload
```

**Total API Routes:** 60+ endpoints

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