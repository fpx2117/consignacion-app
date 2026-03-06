# Sistema Integral de Gestión POS & Consignaciones (B2B SaaS)

Sistema de gestión comercial fullstack construido con **Next.js 16**, **React 19**, **Prisma 7** y **PostgreSQL**. Diseñado para manejar ventas directas (POS), gestión de stock multisucursal y un flujo completo de mercadería en consignación, bajo un modelo de suscripción SaaS con soporte para MercadoPago y PayPal.

> Para documentación técnica detallada (rutas, modelos, enumeraciones) ver [DOCUMENTACION.md](./DOCUMENTACION.md).

---

## Características Principales

- **Multi-Sucursal (Multi-tenant):** Stock, clientes, cajas y configuración completamente aislados por sucursal. Roles `ADMIN` y `EMPLEADO` con restricciones de horario laboral.
- **Control de Stock Dual:** Seguimiento diferenciado entre stock disponible en góndola y stock entregado en consignación.
- **Módulo de Consignaciones:** Flujo completo desde la entrega de mercadería (remito con folio secuencial) hasta la liquidación iterativa y devolución.
- **Punto de Venta (POS):** Terminal de venta con carrito, lector de código de barras, descuentos por ítem y global, múltiples métodos de pago y anulación de ventas.
- **Tienda Pública:** Catálogo online activable por sucursal con personalización de marca, carrusel de banners, temas visuales, redes sociales y checkout integrado con MercadoPago.
- **Envíos con Andreani:** Cotización y gestión de envíos a domicilio o sucursal Andreani desde la tienda pública.
- **Reportes PDF:** Generación server-side con Puppeteer de tickets, remitos, inventario, historial, reporte POS, dashboard y comprobantes de gastos. Todos compartibles via links temporales.
- **Notificaciones en Tiempo Real:** Servidor Socket.io integrado que emite alertas de stock bajo, vencimientos, pagos y consignaciones a los clientes conectados.
- **Seguridad y Auditoría:** Sesiones de usuario rastreadas (IP, dispositivo, geolocalización), log de auditoría por acción/módulo, recuperación de clave por email.
- **Gastos y Finanzas:** Egresos con comprobantes, cuotas recurrentes (semanal/mensual/anual) y distribución proporcional de gastos entre sucursales.
- **SaaS con Suscripciones:** Planes con límites configurables, integración con MercadoPago y PayPal, códigos promocionales y webhooks de pago automáticos.

---

## Stack Tecnológico

| Capa | Tecnología |
| :--- | :--- |
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4, shadcn/ui, Radix UI |
| ORM / DB | Prisma 7 + PostgreSQL (`@prisma/adapter-pg`) |
| Servidor custom | Node.js HTTP + `tsx` (`server.ts`) |
| Tiempo real | Socket.io 4 |
| Reportes PDF | Puppeteer 24 |
| Pagos SaaS | MercadoPago SDK + PayPal |
| Envíos | Andreani (`node-andreani`) |
| Email | Resend |
| Auth | JWT (`jose`) + bcryptjs, sesiones en DB |
| Formularios | React Hook Form + Zod |
| Estado global | Zustand |
| Gráficos | Recharts |
| Animaciones | Motion (Framer Motion v12) |
| Lenguaje | TypeScript 5 |

---

## Reglas de Negocio Clave

| Concepto | Regla |
| :--- | :--- |
| **Stock mínimo** | Si `stockMinUnits` es 0, las notificaciones de stock bajo están desactivadas para ese producto. |
| **Folios** | Las consignaciones tienen un índice `[clienteId, numeroFolio]` para rastrear cronológicamente las entregas por cliente. |
| **Saldo de cliente** | `saldoCuenta > 0` significa deuda pendiente. Se actualiza automáticamente al registrar ventas y pagos. |
| **Integridad histórica** | `onDelete: Restrict` en ventas y consignaciones impide borrar productos con historial. |
| **Notificaciones deduplicadas** | Cada notificación tiene un campo `fingerprint` único que evita alertas repetidas. |
| **Gastos compartidos** | Un gasto puede distribuirse en proporciones distintas entre múltiples sucursales via `GastoSucursal`. |
| **Descuentos por volumen** | Las categorías soportan descuentos escalonados por cantidad mínima (`descuentos: Json`). |
| **ShareLinks seguros** | Cada link compartible tiene `codeHash` para verificar integridad, límite de vistas y fecha de expiración. |
| **Anulación de ventas** | Una venta anulada registra motivo y fecha; sus ítems pueden marcarse como rotura (`esRotura`). |

---

## Configuración del Proyecto

### Requisitos previos

- Node.js v20+
- PostgreSQL 14+
- (Opcional) Cuenta de MercadoPago y/o PayPal para el módulo de pagos.

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/consignacion-app.git
cd consignacion-app
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Copia el archivo de ejemplo y completa las credenciales:

```bash
cp .env.example .env
```

#### Variables requeridas

| Variable | Descripción |
| :--- | :--- |
| `DATABASE_URL` | URI de conexión a PostgreSQL. |
| `JWT_SECRET` | Secreto para firma de tokens JWT. |
| `JWT_COOKIE_NAME` | Nombre interno de la cookie de sesión. |
| `CRON_SECRET` | Token para proteger los endpoints de cron. |
| `PDF_SECRET` | Secreto para firmar los links de reportes PDF. |
| `SHARE_LINK_SECRET` | Secreto para cifrar/verificar ShareLinks. |
| `NEXT_PUBLIC_APP_URL` | URL pública de la aplicación (ej: `https://miapp.com`). |
| `NEXT_PUBLIC_BASE_URL` | URL base usada por el servidor Socket.io y Puppeteer. |
| `SOCKET_DISPATCH_URL` | URL interna del endpoint de despacho de notificaciones. |

#### Variables de pagos SaaS (MercadoPago)

| Variable | Descripción |
| :--- | :--- |
| `MP_ACCESS_TOKEN` | Access Token de la cuenta MercadoPago del SaaS. |
| `MP_PUBLIC_KEY` | Public Key de MercadoPago. |
| `MP_WEBHOOK_SECRET` | Secreto para validar webhooks de MercadoPago. |

#### Variables de pagos SaaS (PayPal)

| Variable | Descripción |
| :--- | :--- |
| `PAYPAL_CLIENT_ID` | Client ID de la app PayPal. |
| `PAYPAL_SECRET` | Secret de la app PayPal. |
| `PAYPAL_WEBHOOK_ID` | ID del webhook registrado en PayPal. |
| `PAYPAL_API_URL` | URL de la API de PayPal (`sandbox` o `live`). |

#### Otras variables

| Variable | Descripción |
| :--- | :--- |
| `RESEND_API_KEY` | API Key de Resend para el envío de emails (reset de clave, etc.). |
| `DEFAULT_TRIAL_DAYS` | Días del período de prueba gratuito (por defecto `7`). |

> Las credenciales de MercadoPago que cada comercio configura para su **tienda pública** se guardan en `Configuracion.mpAccessTokenTienda` / `mpPublicKeyTienda` y se gestionan desde el panel de settings, no desde variables de entorno.

### 4. Configurar la base de datos

```bash
# Genera el cliente de Prisma
npx prisma generate

# Aplica el schema a la base de datos
npx prisma db push
```

**(Opcional)** Poblar con datos iniciales de prueba (usuario admin, configuración base, planes):

```bash
npm run seed
```

### 5. Iniciar en desarrollo

El servidor de desarrollo es un servidor Node.js custom (`server.ts`) que integra Next.js con Socket.io:

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`.

> `npm run dev` ejecuta `tsx server.ts`, no `next dev`, para que Socket.io funcione correctamente.

### 6. Construcción y producción

```bash
# Compila el proyecto (genera cliente Prisma + build de Next.js)
npm run build

# Inicia en producción (aplica migraciones pendientes y levanta el servidor)
npm start
```

`npm start` ejecuta `prisma migrate deploy` antes de iniciar el servidor, garantizando que la base de datos esté sincronizada.

---

## Arquitectura del Servidor

El archivo `server.ts` implementa un servidor HTTP Node.js custom que:

1. **Integra Socket.io** en el mismo proceso que Next.js, evitando la necesidad de un servidor separado.
2. **Expone `/api/socket/dispatch`** como endpoint interno para que los Route Handlers de Next.js puedan emitir eventos a los clientes conectados (notificaciones en tiempo real).
3. **Delega todo lo demás** al request handler de Next.js (`handle`).
4. Escucha en `0.0.0.0` para ser compatible con entornos de cloud (Railway, Render, etc.).

---

## Estructura de Directorios Relevante

```
consignacion-app/
├── prisma/
│   └── schema.prisma          # Modelos de datos completos
├── src/
│   ├── app/
│   │   ├── (system-guard)/
│   │   │   ├── (protected)/   # Rutas protegidas (dashboard, ventas, etc.)
│   │   │   ├── login/
│   │   │   ├── forgot-password/
│   │   │   └── reset-password/
│   │   ├── api/               # Route Handlers de Next.js
│   │   ├── lista/             # Tienda pública (acceso anónimo)
│   │   ├── ver/               # Visores HTML de reportes
│   │   ├── x/[code]/          # Redireccionador de ShareLinks
│   │   └── setup/             # Wizard de configuración inicial
│   ├── lib/
│   │   ├── reports/           # Templates HTML para reportes PDF
│   │   ├── validators/        # Schemas Zod por entidad
│   │   └── *.ts               # Servicios: auth, prisma, mercadopago, etc.
│   ├── providers/             # Socket.io provider + toaster en tiempo real
│   ├── store/                 # Estado global con Zustand
│   └── types/                 # Tipos TypeScript compartidos
├── server.ts                  # Servidor HTTP custom (Next.js + Socket.io)
└── DOCUMENTACION.md           # Documentación técnica detallada
```

---

## Despliegue en Producción

El proyecto está configurado para desplegarse en plataformas como **Railway** o **Render**:

- El script `npm start` aplica migraciones automáticamente antes de iniciar.
- El servidor escucha en `0.0.0.0` con el puerto definido por la variable de entorno `PORT`.
- Asegurarse de que `NEXT_PUBLIC_APP_URL` y `NEXT_PUBLIC_BASE_URL` apunten a la URL pública del deployment.
- Puppeteer requiere que el entorno tenga Chromium disponible (incluido en el paquete por defecto).
