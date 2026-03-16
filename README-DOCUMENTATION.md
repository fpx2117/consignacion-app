# 📚 Documentación del Proyecto - Índice Maestro

**Proyecto:** Consignación App  
**Fecha:** 15 de Marzo de 2026  
**Autor:** JARVIS (Orquestador SDD)

---

## 🎯 Inicio Rápido

```bash
# 1. Clonar el repositorio
git clone https://github.com/fpx2117/consignacion-app.git

# 2. Instalar dependencias
npm install

# 3. Configurar .env
cp .env.example .env
# Editar .env con tus credenciales

# 4. Generar Prisma Client
npx prisma generate

# 5. Iniciar desarrollo
npm run dev
```

---

## 📖 Documentación Disponible

### 📘 Documentos Principales

| Documento | Ubicación | Descripción |
|-----------|-----------|-------------|
| **PROYECTO-MAESTRO** | `DOCUMENTATION/PROYECTO-MAESTRO.md` | Visión general del proyecto, arquitectura, stack, flujos |
| **ESTRUCTURA-COMPLETA** | `DOCUMENTATION/ESTRUCTURA-COMPLETA.md` | Estructura detallada de carpetas y archivos |
| **FLOW-SUCURSALES** | `DOCUMENTATION/FLOW-DETECCION-SUCURSAL-PAQUETES.md` | Flujos de sucursal y planes (rediseño reciente) |

### 📋 Documentación del Change (Rediseño Sucursal)

| Documento | Ubicación | Descripción |
|-----------|-----------|-------------|
| **Proposal** | `openspec/changes/rediseno-deteccion-sucursal/proposal.md` | Propuesta del cambio (150 líneas) |
| **Design** | `openspec/changes/rediseno-deteccion-sucursal/design.md` | Diseño técnico (278 líneas) |
| **Tasks** | `openspec/changes/rediseno-deteccion-sucursal/tasks.md` | Checklist de implementación (63 líneas, 32 tareas) |

---

## 📑 Índice por Categoría

### 🔐 Autenticación

| Tema | Documento | Sección |
|------|-----------|---------|
| Login y JWT | PROYECTO-MAESTRO.md | Sección 6 - Flujos de Autenticación |
| Cookie active_sucursal_id | FLOW-SUCURSALES.md | Flow 1 - Login |
| Guard server-side | FLOW-SUCURSALES.md | Flow 2 - Validación |

### 🏪 Sucursales

| Tema | Documento | Sección |
|------|-----------|---------|
| Cambio de sucursal | FLOW-SUCURSALES.md | Flow 2 |
| Vista Global | FLOW-SUCURSALES.md | Flow 5 |
| BroadcastChannel | FLOW-SUCURSALES.md | Flow 6 |

### 📦 Planes/Suscripciones

| Tema | Documento | Sección |
|------|-----------|---------|
| Detección de plan | FLOW-SUCURSALES.md | Flow 3 |
| Validación de features | FLOW-SUCURSALES.md | Flow 4 |
| Cambio de plan | FLOW-SUCURSALES.md | Flow 7 |

### 📁 Estructura del Proyecto

| Tema | Documento | Sección |
|------|-----------|---------|
| Carpetas y archivos | ESTRUCTURA-COMPLETA.md | Todo el documento |
| API Routes | ESTRUCTURA-COMPLETA.md | Sección src/app/api/ |
| Components | ESTRUCTURA-COMPLETA.md | Sección src/components/ |

---

## 🔍 Navegación Rápida

### ¿Qué necesitas saber?

| Si quieres... | Ve a... |
|---------------|---------|
| **Ver arquitectura general** | `PROYECTO-MAESTRO.md` → Sección 2 |
| **Entender la base de datos** | `PROYECTO-MAESTRO.md` → Sección 5 |
| **Ver flujos de negocio** | `PROYECTO-MAESTRO.md` → Sección 15 |
| **Ver estructura de carpetas** | `ESTRUCTURA-COMPLETA.md` → Todo |
| **Entender rediseño sucursal** | `FLOW-DETECCION-SUCURSAL-PAQUETES.md` |
| **Ver archivos modificados** | `openspec/changes/rediseno-deteccion-sucursal/tasks.md` |
| **Listar todos los endpoints** | `ESTRUCTURA-COMPLETA.md` → Sección API Routes |

---

## 📊 Resumen del Proyecto

### Stack Tecnológico

```bash
Next.js 16.1.6    # App Router + RSC
React 19.2.3      # Server + Client Components
TypeScript 5.9.3  # Tipado estricto
Prisma 7.3.0      # ORM PostgreSQL
Zustand 5.0.11    # Store client-side
Tailwind CSS 4.0  # Styling
PostgreSQL        # Base de datos en Railway
```

### Estadísticas

| Métrica | Valor |
|---------|-------|
| **Archivos** | 400+ |
| **Directorios** | 225+ |
| **Líneas de código** | ~30,000 |
| **API Routes** | 60+ endpoints |
| **Components** | 100+ |
| **Models Prisma** | 30+ tablas |

---

## 🚀 Flujos Principales

### Flow 1: Login y Detección de Sucursal

```
1. POST /api/auth/login
   └─► Cookie active_sucursal_id = user.sucursalId

2. Store hydrate() con datos del server
   └─► activeSucursalId, availableSucursales, planLimits

3. Redirección a Dashboard
```

### Flow 2: Cambio de Sucursal (Admin)

```
1. User click en TopBar dropdown
2. POST /api/sucursal/switch { sucursalId: N }
3. Server valida permisos (solo ADMIN)
4. Set cookie active_sucursal_id = N
5. BroadcastChannel notifica pestañas
6. Todas las pestañas router.refresh()
```

### Flow 3: Detección de Plan

```
1. Protected Layout RSC
   └─► getActivePlanLimits() con React.cache

2. Pasa planLimits como prop
   └─► SubscriptionGuard recibe props

3. Verificación server-side
   └─► checkFeature("allowSucursales")
```

### Flow 4: Cambio de Plan

```
1. User compra upgrade
2. Webhook confirma pago
3. BroadcastChannel "plan-changed"
4. Todas las pestañas router.refresh()
5. Nuevos límites aplicados inmediatamente
```

---

## 🔧 Variables de Entorno

### ⚠️ Archivo .env (OBLIGATORIO)

```bash
# Database
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

# TZ (OBLIGATORIO)
TZ=America/Argentina/Buenos_Aires
```

---

## 📚 APIs Disponibles

### Autenticación
```
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
```

### Sucursales
```
POST   /api/sucursal/switch          # Cambiar sucursal activa
```

### Suscripciones
```
GET    /api/subscriptions/current    # Plan actual
GET    /api/subscriptions/plans      # Lista de planes
POST   /api/subscriptions/cancel     # Cancelar suscripción
POST   /api/subscriptions/mercadopago/create
POST   /api/subscriptions/paypal/create
POST   /api/subscriptions/promo/redeem
```

### Clientes
```
GET/POST /api/clientes
GET/PUT/DELETE /api/clientes/:id
GET    /api/clientes/:id/estado-cuenta
GET    /api/clientes/:id/pagos
```

### Ventas
```
GET/POST /api/ventas
GET    /api/ventas/:id/ticket-link
```

### Dashboard
```
GET    /api/dashboard/kpi
GET    /api/dashboard/tendencia
GET    /api/dashboard/top-productos
```

---

## 🎯 Rediseño Reciente (Commit 4a4ee81)

### Bugs Resueltos (10)

1. ✅ Triple fuente de verdad (header/cookie/JWT) → Cookie httpOnly
2. ✅ Zustand rehydration prematura → Store sin persist
3. ✅ Cache stale SubscriptionGuard (5min) → PlanLimits como prop
4. ✅ subscription_limits en localStorage → Eliminado
5. ✅ JWT sucursalId hardcoded 7 días → Removido
6. ✅ usarControlDeCaja sin scope → Key scoped
7. ✅ Vista Global inconsistente → Tratamiento explícito
8. ✅ Sin sync entre pestañas → BroadcastChannel
9. ✅ Race conditions → Validación server-side
10. ✅ checkedRef bypass → Eliminado

### Archivos Nuevos

| Archivo | Líneas | Propósito |
|---------|--------|-----------|
| `src/lib/broadcast-channel.ts` | 60 | Channel API con fallback |
| `src/hooks/useBroadcastChannel.ts` | 44 | Hook React para mensajes |
| `src/app/api/sucursal/switch/route.ts` | 62 | Endpoint cambio sucursal |

### Tests Realizados

✅ Login con base PostgreSQL real  
✅ Cambio de sucursal funcional  
✅ Empleado NO puede cambiar sucursal (403)  
✅ Vista Global (id=0) funciona  
✅ PlanLimits desde base real  
✅ 7/7 tests manuales PASADOS  

---

## 📞 Soporte y Ayuda

### Problemas Comunes

| Problema | Solución |
|----------|----------|
| **Error de database** | Verificar DATABASE_URL en .env |
| **Build falla** | `npx prisma generate && npm run build` |
| **TypeScript errors** | `npx tsc --noEmit` para ver errores |
| **ESLint warnings** | `npm run lint` |
| **Server no inicia** | Verificar puerto 3000 libre |

### Comandos Útiles

```bash
# Reiniciar servidor
pkill -f "next dev" && npm run dev

# Ver logs
tail -f /var/log/nextjs.log

# Generar migration
npx prisma migrate dev --name nombre-migration

# Reset database (DEV)
npx prisma migrate reset
```

---

## 📅 Historial de Cambios

### Commit Actual: 4a4ee81

```
feat: Rediseño detección sucursal y paquetes — 32 tareas completadas
Date: Sun Mar 15 2026
Files: 24 changed, 1248 insertions(+), 205 deletions(-)
```

### Commits Recientes

```
4a4ee81 Rediseño detección sucursal y paquetes
8549c36 fix(timezone): auto-migrate dates when timezone changes
1fc1fdc fix(db): set timezone Argentina on every PostgreSQL connection
02c3141 fix(reports): restore tailwind-inline
82c7254 fix: fuente Geist inline en reportes PDF
```

---

## 🎨 Estructura Visual

```
📁 consignacion-app/
│
├── 📄 README-DOCUMENTATION.md (este archivo)
├── 📁 DOCUMENTATION/
│   ├── PROYECTO-MAESTRO.md
│   ├── ESTRUCTURA-COMPLETA.md
│   └── FLOW-DETECCION-SUCURSAL-PAQUETES.md
│
├── 📁 openspec/changes/
│   └── rediseno-deteccion-sucursal/
│       ├── proposal.md
│       ├── design.md
│       └── tasks.md
│
└── 📁 src/
    ├── app/           # App Router
    ├── components/    # UI Components
    ├── lib/           # Librerías
    ├── store/         # Zustand stores
    ├── hooks/         # Custom hooks
    └── providers/     # React providers
```

---

## ✅ Checklist de Inicio

- [ ] Clonar repositorio
- [ ] Instalar dependencias (`npm install`)
- [ ] Configurar .env (`cp .env.example .env`)
- [ ] Generar Prisma Client (`npx prisma generate`)
- [ ] Ejecutar migraciones (`npx prisma migrate dev`)
- [ ] Iniciar servidor (`npm run dev`)
- [ ] Probar login (`vasconceldiego2@gmail.com` / `fvS9f3yq21@`)

---

**Fin de Documentación** ✅

*Documento generado por JARVIS (Orquestador SDD) - 15/03/2026*

---

## 🔗 Enlaces Útiles

- **Repositorio:** https://github.com/fpx2117/consignacion-app
- **Documentación:** `DOCUMENTATION/PROYECTO-MAESTRO.md`
- **Flujos:** `DOCUMENTATION/FLOW-DETECCION-SUCURSAL-PAQUETES.md`
- **Estructura:** `DOCUMENTATION/ESTRUCTURA-COMPLETA.md`