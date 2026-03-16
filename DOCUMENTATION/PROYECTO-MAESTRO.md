# 📘 PROYECTO COMPLETO: Sistema de Gestión de Consignaciones

**Proyecto:** Consignación App  
**Fecha:** 15 de Marzo de 2026  
**Autor:** JARVIS (Orquestador SDD)  
**Versión:** 1.0.0  
**Stack Tecnológico:** Next.js 16 + React 19 + Prisma 7 + PostgreSQL + TypeScript

---

## 📋 Índice

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura General](#2-arquitectura-general)
3. [Stack Tecnológico](#3-stack-tecnológico)
4. [Estructura de Carpetas](#4-estructura-de-carpetas)
5. [Base de Datos (Prisma)](#5-base-de-datos-prisma)
6. [Flujos de Autenticación](#6-flujos-de-autenticación)
7. [Flujos de Sucursal](#7-flujos-de-sucursal)
8. [Flujos de Planes/Subscription](#8-flujos-de-planes-subscription)
9. [API Routes](#9-api-routes)
10. [Components UI](#10-components-ui)
11. [Store (Zustand)](#11-store-zustand)
12. [Features del Sistema](#12-features-del-sistema)
13. [Variables de Entorno](#13-variables-de-entorno)
14. [Comandos y Scripts](#14-comandos-y-scripts)
15. [Flujos de Negocio Específicos](#15-flujos-de-negocio-específicos)

---

## 1. Resumen Ejecutivo

### 🎯 Propósito del Sistema

Sistema POS (Point of Sale) para gestión de **consignaciones** entre proveedores y tiendas, con soporte para:
- Múltiples sucursales
- Planes de suscripción (Básico, Pro, Enterprise)
- Pagos con MercadoPago y PayPal
- Reportes y análisis en tiempo real
- Notificaciones vía WhatsApp y Email

### 📊 Estadísticas del Proyecto

| Métrica | Valor |
|---------|-------|
| **Archivos totales** | 400+ |
| **Directorios** | 225+ |
| **Líneas de código** | ~30,000+ |
| **API Routes** | 60+ endpoints |
| **Components** | 100+ componentes React |
| **Models Prisma** | 30+ tablas |

### 🔑 Características Principales

- ✅ Autenticación JWT con cookies httpOnly
- ✅ Multi-sucursal con permisos por rol (ADMIN/EMPLEADO)
- ✅ Planes de suscripción con límites configurables
- ✅ Sincronización cross-tab con BroadcastChannel
- ✅ Reportes PDF generados en tiempo real
- ✅ Pagos con MercadoPago y PayPal integrados
- ✅ Notificaciones vía Socket.io
- ✅ Zona horaria configurable por sucursal

---

## 2. Arquitectura General

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BROWSER (Client)                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐  │
│  │   Next.js   │  │   Zustand   │  │  Socket.io  │  │  BroadcastChannel│  │
│  │  Client     │  │  Store      │  │  Client     │  │  (Cross-tab)     │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────────────┘  │
│         │                │               │                    │             │
│         └────────────────┼───────────────┼────────────────────┘             │
│                          │                                                  │
└──────────────────────────┼──────────────────────────────────────────────────┘
                           │
                           ▼ HTTP/HTTPS/WebSockets
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NEXT.JS SERVER (API)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐  │
│  │  RSC Router │  │  API Routes │  │  Middleware │  │  Socket Server   │  │
│  │  (Layouts)  │  │  (REST)     │  │  (Auth)     │  │  (Real-time)     │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────────────┘  │
│         │                │               │                    │             │
│         └────────────────┼───────────────┼────────────────────┘             │
│                          │                                                  │
└──────────────────────────┼──────────────────────────────────────────────────┘
                           │
                           ▼ Prisma Client
┌─────────────────────────────────────────────────────────────────────────────┐
│                      POSTGRESQL DATABASE (Railway)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐  │
│  │  Usuarios   │  │  Sucursales │  │  Products   │  │  Subscription    │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                        │
│  │  Ventas     │  │  Pagos      │  │  Reportes   │                        │
│  └─────────────┘  └─────────────┘  └─────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Stack Tecnológico

### Dependencias Principales

| Categoría | Tecnología | Versión | Uso |
|-----------|------------|---------|-----|
| **Framework** | Next.js | 16.1.6 | App Router, RSC, API Routes |
| **UI Framework** | React | 19.2.3 | Componentes client y server |
| **Lenguaje** | TypeScript | 5.9.3 | Tipado estricto |
| **ORM** | Prisma | 7.3.0 | Base de datos PostgreSQL |
| **Store** | Zustand | 5.0.11 | Estado global client-side |
| **UI Components** | Radix UI + shadcn | Latest | Componentes accesibles |
| **Styling** | Tailwind CSS | 4.0 | Utility-first CSS |
| **Validación** | Zod | 4.3.6 | Schema validation |
| **Forms** | React Hook Form | 7.71.1 | Form management |
| **Charts** | Recharts | 3.7.0 | Gráficos y visualizaciones |
| **Socket** | Socket.io | 4.8.3 | Comunicación real-time |
| **PDF** | Puppeteer | 24.37.2 | Generación de reportes |
| **Email** | Resend | 6.9.2 | Envío de correos |
| **MercadoPago** | mercadopago-sdk | 2.12.0 | Pagos argentinos |
| **PayPal** | @paypal/react-paypal-js | 8.9.2 | Pagos internacionales |

### Dependencias de Desarrollo

| Herramienta | Uso |
|-------------|-----|
| **ESLint** | Linting y calidad de código |
| **Prisma** | Generación de cliente y migraciones |
| **tsx** | Ejecución TypeScript en dev |
| **shadcn** | CLI para componentes UI |

---

## 4. Estructura de Carpetas

### 📁 Estructura General

```
consignacion-app/
├── 📄 package.json                    # Dependencias y scripts
├── 📄 tsconfig.json                   # Configuración TypeScript
├── 📄 tailwind.config.ts              # Configuración Tailwind
├── 📄 next.config.js                  # Configuración Next.js
├── 📄 .env                           # Variables de entorno (NO commit)
├── 📄 .env.example                   # Template de variables
├── 📄 .eslintrc.json                 # Configuración ESLint
├──
├── 📁 prisma/                        # Configuración ORM
│   ├── schema.prisma                # Modelo de datos
│   └── seed.ts                      # Datos de prueba
│
├── 📁 src/                           # Código fuente
│   ├── 📁 app/                      # App Router (Next.js 16)
│   │   ├── 📁 (system-guard)/      # Rutas protegidas
│   │   │   ├── 📁 (protected)/    # Rutas autenticadas
│   │   │   │   ├── 📁 dashboard/  # Dashboard principal
│   │   │   │   ├── 📁 settings/   # Configuraciones
│   │   │   │   ├── 📁 clientes/   # Gestión de clientes
│   │   │   │   ├── 📁 ventas/     # Gestión de ventas
│   │   │   │   └── ... más rutas
│   │   │   └── layout.tsx         # Layout protegido
│   │   ├── 📁 api/                # API Routes
│   │   │   ├── 📁 auth/           # Autenticación
│   │   │   ├── 📁 sucursal/       # Gestión de sucursales
│   │   │   ├── 📁 subscriptions/  # Suscripciones
│   │   │   └── ... más endpoints
│   │   ├── login.tsx              # Página de login
│   │   ├── forgot-password.tsx    # Recuperación de contraseña
│   │   └── ...
│   │
│   ├── 📁 components/              # Componentes UI
│   │   ├── SubscriptionGuard.tsx  # Guard de suscripción
│   │   ├── SidebarDock.tsx        # Sidebar lateral
│   │   ├── TopBar.tsx             # Barra superior
│   │   ├── GlobalReadonlyGuard.tsx # Vista global
│   │   └── ... (100+ componentes)
│   │
│   ├── 📁 store/                   # Zustand stores
│   │   ├── useSucursalStore.ts    # Store de sucursal
│   │   └── ...
│   │
│   ├── 📁 lib/                     # Librerías y utilidades
│   │   ├── auth/                  # Autenticación
│   │   │   ├── require-auth.ts   # Guard server-side
│   │   │   ├── core.ts           # JWT y cookies
│   │   │   └── ...
│   │   ├── subscriptions/        # Lógica de suscripciones
│   │   ├── broadcast-channel.ts  # Channel API
│   │   ├── apiService.ts         # Cliente API
│   │   └── ... más utilidades
│   │
│   ├── 📁 hooks/                  # Custom Hooks React
│   │   ├── useBroadcastChannel.ts
│   │   └── ...
│   │
│   ├── 📁 providers/              # React Providers
│   │   ├── SocketProvider.tsx
│   │   └── ...
│   │
│   └── 📁 constants/              # Constantes del sistema
│       ├── subscriptions.ts      # Planes y límites
│       └── ...
│
├── 📁 public/                      # Assets estáticos
│   ├── logo.png
│   └── ...
│
└── 📁 DOCUMENTATION/               # Documentación
    ├── PROYECTO-MAESTRO.md        # Este archivo
    └── FLOW-DETECCION-SUCURSAL-PAQUETES.md
```

### 📁 Estructura de API Routes

```
src/app/api/
├── 📁 auth/
│   ├── login/route.ts             # POST /api/auth/login
│   ├── logout/route.ts            # POST /api/auth/logout
│   ├── me/route.ts                # GET /api/auth/me
│   ├── forgot-password/route.ts   # POST /api/auth/forgot-password
│   └── reset-password/route.ts    # POST /api/auth/reset-password
│
├── 📁 sucursal/
│   └── switch/route.ts            # POST /api/sucursal/switch (NUEVO)
│
├── 📁 subscriptions/
│   ├── current/route.ts           # GET /api/subscriptions/current
│   ├── plans/route.ts             # GET /api/subscriptions/plans
│   ├── cancel/route.ts            # POST /api/subscriptions/cancel
│   ├── mercadopago/create/route.ts
│   ├── paypal/create/route.ts
│   └── promo/redeem/route.ts
│
├── 📁 clientes/
│   ├── route.ts                   # GET/POST /api/clientes
│   ├── [id]/route.ts              # GET/PUT/DELETE /api/clientes/:id
│   └── ...
│
├── 📁 ventas/
│   ├── route.ts                   # GET/POST /api/ventas
│   └── ...
│
├── 📁 cron/
│   ├── check-subscriptions/route.ts    # Verificación de suscripciones
│   ├── check-vencimientos/route.ts     # Verificación de vencimientos
│   └── ...
│
└── ... (60+ endpoints)
```

---

## 5. Base de Datos (Prisma)

### 📊 Modelo de Datos Principal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TABLAS PRINCIPALES                             │
├─────────────────────────────────────────────────────────────────────────────┤

1. 📋 Usuario
   ├── id (PK)
   ├── nombre, email, hash (password)
   ├── rol (ADMIN/EMPLEADO)
   ├── activo (Boolean)
   ├── sucursalId (FK → Sucursal)
   └── subscription (relación 1:1)

2. 📋 Sucursal
   ├── id (PK)
   ├── nombre
   ├── esPrincipal (Boolean)
   ├── activa (Boolean)

3. 📋 Subscription
   ├── id (PK)
   ├── userId (FK → Usuario)
   ├── planId (FK → Plan)
   ├── status (ACTIVO/PRUEBA/CANCELADO)
   ├── externalId (MercadoPago/PayPal)
   ├── trialEndsAt, currentPeriodEnd

4. 📋 Plan
   ├── id (PK)
   ├── nombre (Básico/Pro/Enterprise)
   ├── precioARS, precioUSD
   ├── features (JSON array)

5. 📋 PlanLimits
   ├── id (PK)
   ├── planId (FK → Plan)
   ├── maxProductos
   ├── maxUsuarios
   ├── allowConsignaciones (Boolean)
   ├── allowSucursales (Boolean)

6. 📋 Configuracion (por sucursal)
   ├── id (PK)
   ├── sucursalId (FK → Sucursal)
   ├── zonaHoraria
   ├── usarControlDeCaja
   └── ... (30+ campos de configuración)

7. 📋 Cliente
   ├── id (PK)
   ├── nombre, email, documento
   ├── sucursalId (FK → Sucursal)
   ├── saldoCuenta (Decimal)

8. 📋 Venta
   ├── id (PK)
   ├── clienteId (FK → Cliente)
   ├── sucursalId (FK → Sucursal)
   ├── total (Decimal)
   ├── fecha

9. 📋 Pago
   ├── id (PK)
   ├── clienteId (FK → Cliente)
   ├── monto (Decimal)
   ├── tipo (EFECTIVO/TRANSF/TARJETA)
   ├── fecha

10. 📋 Consignacion
    ├── id (PK)
    ├── clienteId (FK → Cliente)
    ├── sucursalId (FK → Sucursal)
    ├── estado (PENDIENTE/COMPLETADO)
    └── ... (campos de logística)

└─────────────────────────────────────────────────────────────────────────────┘
```

### 🗂️ Relaciones Clave

```prisma
// Relación Usuario ↔ Sucursal
Usuario.sucursalId → Sucursal.id (optional)

// Relación Usuario ↔ Subscription (1:1)
Usuario.id → Subscription.userId

// Relación Subscription ↔ Plan
Subscription.planId → Plan.id

// Relación Plan ↔ PlanLimits (1:1)
Plan.id → PlanLimits.planId

// Relación Configuracion ↔ Sucursal (1:1)
Configuracion.sucursalId → Sucursal.id (unique)
```

### 🌐 Configuración de Zona Horaria

- **Por defecto:** `America/Argentina/Buenos_Aires` (UTC-3)
- **Configurable por sucursal:** `Configuracion.zonaHoraria`
- **Aplicado en:** Server (TZ env), Client (useTimezone hook)

---

## 6. Flujos de Autenticación

### 🔐 Login

```
1. POST /api/auth/login
   ├─► Validar email/password
   ├─► Verificar usuario activo
   ├─► Generar JWT (sin sucursalId)
   ├─► Setear cookies:
   │   ├─► JWT (httpOnly)
   │   └─► active_sucursal_id = user.sucursalId
   └─► Return user data

2. Client → useSucursalStore.hydrate()
   └─► activeSucursalId desde server
   └─► planLimits desde server

3. Redirección → Dashboard
```

### 🔒 Guard Server-Side (require-auth.ts)

```typescript
export async function requireAuth() {
  // 1. Leer JWT desde cookies
  const token = await getAuthTokenFromCookies();
  
  // 2. Verificar sesión activa
  const session = await validateSession(token);
  
  // 3. Decodificar JWT
  const user = await verifyUserJwt(token);
  
  // 4. Resolver sucursal activa
  let activeSucursalId = user.sucursalId || 1;
  
  if (user.rol === "ADMIN") {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get("active_sucursal_id")?.value;
    if (cookieValue && !isNaN(parseInt(cookieValue))) {
      activeSucursalId = parseInt(cookieValue);
    }
  }
  
  return { ok: true, user, activeSucursalId };
}
```

---

## 7. Flujos de Sucursal

### 👑 Cambio de Sucursal (Admin)

**Endpoint:** `POST /api/sucursal/switch`

**Validaciones:**
- ✅ Usuario debe ser ADMIN
- ✅ Sucursal debe existir y estar activa
- ✅ Vista Global (id=0) solo para admins

**Flujo:**
```
1. Client → POST /api/sucursal/switch { sucursalId: 2 }
2. Server → requireAuth() → Verificar rol === ADMIN
3. Server → Validar sucursal en DB
4. Server → Set cookie active_sucursal_id = 2
5. Server → Return { ok: true, activeSucursalId: 2 }
6. Client → Store.switchSucursal()
7. Client → postAppMessage("sucursal-changed")
8. Browser → BroadcastChannel envía mensaje
9. Otras pestañas → router.refresh()
```

### 👤 Sucursal de Empleado

- Empleados tienen `sucursalId` fijo en DB
- No pueden cambiar de sucursal (403 error)
- Solo ven datos de su sucursal asignada

### 👁️ Vista Global (id=0)

- Solo admins pueden acceder
- Muestra datos consolidados de todas las sucursales
- UI bloqueada (solo lectura)

---

## 8. Flujos de Planes/Subscription

### 📦 Planes Disponibles

| Plan | Precio (ARS) | Max Productos | Max Usuarios | Sucursales | Consignaciones |
|------|--------------|---------------|--------------|------------|----------------|
| **Básico** | $60,000 | 60 | 5 | ❌ | ❌ |
| **Pro** | $80,000 | Ilimitado | 15 | ❌ | ✅ |
| **Enterprise** | $150,000 | Ilimitado | 100 | ✅ | ✅ |

### 🔄 Cambio de Plan

```
1. User compra upgrade en /settings/subscriptions
2. POST /api/subscriptions/mercadopago/create
3. MercadoPago → Payment success
4. Webhook actualiza subscription en DB
5. Client postAppMessage("plan-changed")
6. BroadcastChannel notifica a todas las pestañas
7. Todas las pestañas router.refresh()
8. Layout re-fetch planLimits desde DB
9. UI muestra nuevas features inmediatamente
```

### ⚠️ Validación de Features

```
Server-side check:
- getActivePlanLimits()
- checkFeature("allowSucursales")
- checkProductLimit(cantidadActual)
```

---

## 9. API Routes

### 🔑 Endpoints Principales

#### Autenticación
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login usuario |
| POST | `/api/auth/logout` | Logout sesión |
| GET | `/api/auth/me` | Datos usuario autenticado |
| POST | `/api/auth/forgot-password` | Recuperar contraseña |
| POST | `/api/auth/reset-password` | Nueva contraseña |

#### Sucursales
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/sucursal/switch` | Cambiar sucursal activa |

#### Suscripciones
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/subscriptions/current` | Plan actual |
| GET | `/api/subscriptions/plans` | Lista de planes |
| POST | `/api/subscriptions/cancel` | Cancelar suscripción |
| POST | `/api/subscriptions/mercadopago/create` | Crear pago MP |
| POST | `/api/subscriptions/paypal/create` | Crear pago PayPal |
| POST | `/api/subscriptions/promo/redeem` | Canjear código promo |

#### Clientes
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET/POST | `/api/clientes` | Listar/Crear cliente |
| GET/PUT/DELETE | `/api/clientes/:id` | CRUD cliente |
| GET | `/api/clientes/:id/estado-cuenta` | Estado de cuenta |
| GET | `/api/clientes/:id/pagos` | Pagos del cliente |

#### Ventas
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET/POST | `/api/ventas` | Listar/Crear venta |
| GET | `/api/ventas/:id/ticket-link` | Link de ticket |

#### Reportes (Cron)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/cron/check-subscriptions` | Verificar suscripciones vencidas |
| GET | `/api/cron/check-vencimientos` | Verificar vencimientos |
| GET | `/api/dashboard/kpi` | KPIs del dashboard |

---

## 10. Components UI Principales

### 🎨 Layouts

| Componente | Archivo | Propósito |
|------------|---------|-----------|
| `ProtectedLayout` | `src/app/(system-guard)/(protected)/layout.tsx` | Layout con auth, sidebar, topbar |
| `RootLayout` | `src/app/layout.tsx` | Layout global (theme, providers) |

### 🔒 Guards

| Componente | Archivo | Propósito |
|------------|---------|-----------|
| `SubscriptionGuard` | `src/components/SubscriptionGuard.tsx` | Verifica plan activo (recibe props) |
| `GlobalReadonlyGuard` | `src/components/global-readonly-guard.tsx` | Bloquea UI en vista global |
| `requireAuth` (server) | `src/lib/auth/require-auth.ts` | Guard server-side |

### 📊 UI Components

| Componente | Archivo | Propósito |
|------------|---------|-----------|
| `SidebarDock` | `src/components/sidebar-dock.tsx` | Sidebar lateral con sucursales |
| `TopBar` | `src/components/top-bar.tsx` | Barra superior con selector |
| `SubscriptionGuard` | `src/components/SubscriptionGuard.tsx` | Verificación de plan |
| `SocketToaster` | `src/providers/socket-toaster.tsx` | Notificaciones toast |

### 🔌 Providers

| Provider | Archivo | Propósito |
|----------|---------|-----------|
| `SocketProvider` | `src/providers/socket-provider.tsx` | Conexión Socket.io |
| `ThemeProvider` | `src/components/theme-provider.tsx` | Tema claro/oscuro |

---

## 11. Store (Zustand)

### 📦 useSucursalStore

```typescript
interface SucursalState {
  activeSucursalId: number;
  availableSucursales: Sucursal[];
  isHydrated: boolean;
  planLimits: PlanLimits | null;
  pedidosVencidosCount: number;
  
  hydrate: (data: HydratePayload) => void;
  switchSucursal: (id: number) => Promise<void>;
  setPedidosVencidosCount: (count: number) => void;
}
```

**Características:**
- ✅ Sin persist (solo en memoria)
- ✅ Hidratado desde SSR
- ✅ BroadcastChannel para sync cross-tab

---

## 12. Features del Sistema

### 🛒 POS (Point of Sale)

- Ventas rápidas con teclado
- Selección de productos por barcode
- Múltiples métodos de pago
- Cierre de caja y turnos

### 📦 Gestión de Consignaciones

- Creación de consignaciones con proveedores
- Seguimiento de estados
- Liquidación de consignaciones
- Reportes de rendimiento

### 📊 Dashboard

- KPIs en tiempo real
- Gráficos de ventas
- Top productos
- Tendencias

### 🔔 Notificaciones

- Stock bajo
- Vencimientos
- Nuevas ventas
- Por WebSocket y Email

### 📄 Reportes PDF

- Tickets de venta
- Reportes periódicos
- Compartibles por link

### 🌐 Multi-sucursal

- Gestión centralizada
- Permisos por rol
- Configuración por sucursal

---

## 13. Variables de Entorno

### ⚠️ Archivo .env (NO commit)

```bash
# TZ — Argentina
TZ=America/Argentina/Buenos_Aires

# Database (Railway)
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# JWT
JWT_SECRET="..."
JWT_COOKIE_NAME="..."

# URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000

# MercadoPago
MP_ACCESS_TOKEN=...
MP_PUBLIC_KEY=...
MP_WEBHOOK_SECRET=...

# PayPal
PAYPAL_MODE=live
PAYPAL_CLIENT_ID=...
PAYPAL_SECRET=...
PAYPAL_WEBHOOK_ID=...

# Plans Config
PLAN_1_MAX_PRODUCTOS=60
PLAN_2_ALLOW_SUCURSALES=false
PLAN_3_ALLOW_SUCURSALES=true

# CRON
CRON_SECRET="..."
```

---

## 14. Comandos y Scripts

### 🚀 Desarrollo

```bash
# Instalar dependencias
npm install

# Iniciar servidor dev
npm run dev

# Generar Prisma Client
npx prisma generate

# Migrar base de datos
npx prisma migrate dev

# Seed datos de prueba
npm run seed
```

### 🔨 Producción

```bash
# Build
npm run build

# Start
npm start

# Lint
npm run lint

# TypeScript check
npx tsc --noEmit
```

### 🔧 Prisma

```bash
# Ver schema
npx prisma studio

# Generar migration
npx prisma migrate dev --name add_feature

# Push schema (sin migration)
npx prisma db push
```

---

## 15. Flujos de Negocio Específicos

### 🔄 Flow 1: Venta Rápida (POS)

```
1. Usuario selecciona productos
2. Calcula total con impuestos
3. Selección método de pago
4. POST /api/ventas
5. Actualiza stock (si aplica)
6. Genera ticket PDF
7. Notifica vía WebSocket
```

### 🔄 Flow 2: Consignación con Proveedor

```
1. Crear consignación ( productos + proveedor )
2. Generar remito PDF
3. Enviar notificación al proveedor
4. Seguimiento de entrega
5. Liquidación cuando se venden productos
```

### 🔄 Flow 3: Pago de Cliente

```
1. Cliente selecciona productos
2. Genera factura
3. Selección método pago
4. POST /api/pagos
5. Actualiza saldo cuenta cliente
6. Genera comprobante
```

### 🔄 Flow 4: Liquidación de Proveedor

```
1. Proveedor consulta consignaciones pendientes
2. Calcula monto a liquidar
3. Genera liquidación PDF
4. Registra pago
5. Actualiza estado consignaciones
```

---

## 📚 Documentación Adicional

| Documento | Ubicación | Descripción |
|-----------|-----------|-------------|
| FLOW-DETECCION-SUCURSAL | `DOCUMENTATION/FLOW-DETECCION-SUCURSAL-PAQUETES.md` | Flujos de sucursal y planes |
| PROYECTO-MAESTRO | `DOCUMENTATION/PROYECTO-MAESTRO.md` | Este documento |

---

**Fin de Documentación** ✅

*Documento generado por JARVIS (Orquestador SDD) - 15/03/2026*

---

## 🚀 Comandos Rápidos de Referencia

```bash
# Ver cambios en git
git log -1 --stat

# Ver archivos modificados
git diff --name-only

# Correr tests manuales
npm run dev
# Abrir http://localhost:3000

# Ver logs del servidor
tail -f /var/log/nextjs.log

# Reiniciar servidor
pkill -f "next dev" && npm run dev
```