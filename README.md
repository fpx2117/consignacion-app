# Consignación App — POS, inventario, consignaciones y tienda online

Plataforma fullstack para negocios que necesitan operar **punto de venta**, **stock multisucursal**, **consignaciones**, **catálogo público** y **suscripciones** desde un mismo sistema. Está construida con **Next.js 16**, **React 19**, **Prisma 7** y **PostgreSQL**, e incorpora tiempo real, reportes PDF, checkout online y automatizaciones operativas.

> **Unidad de despliegue:** una instalación con su propia base de datos por comercio.
> No es multi-tenant: no existe tabla de organizaciones ni de tenants, y dos negocios
> no comparten base. Cada instalación sí puede tener **varias sucursales**, que están
> aisladas entre sí. Es una decisión tomada, no una deuda pendiente: ver
> `odd/evolucion-arquitectura-backend/README.md`, decisión 1.

> Documentación técnica extendida: [docs/INDEX.md](./docs/INDEX.md) · [docs/GUIA_TECNICA_PROYECTO.md](./docs/GUIA_TECNICA_PROYECTO.md) · [docs/API_REFERENCIA_TECNICA.md](./docs/API_REFERENCIA_TECNICA.md) · [ADR-0001](./docs/ADR/0001-servidor-custom-next-socketio.md)

---

## Inicio rápido

### Requisitos

- Node.js 20.19+, 22.12+ o 24+
- PostgreSQL 14+
- npm

### Instalación

```bash
git clone https://github.com/tu-usuario/consignacion-app.git
cd consignacion-app
npm install
cp .env.example .env
```

### Base de datos

```bash
npx prisma generate
npm run migrate:t11:deploy
npm run seed
```

### Desarrollo

```bash
npm run dev
```

App disponible en `http://localhost:3000`.

> `npm run dev` usa `tsx server.ts` porque la app corre con servidor custom para integrar Next.js + Socket.io en el mismo proceso.

---

## Qué resuelve

Consignación App unifica en una sola plataforma:

- ventas en mostrador y caja (POS)
- control de inventario por sucursal
- mercadería entregada en consignación
- catálogo/tienda online pública
- cobranzas y suscripciones del plan
- reportes operativos compartibles
- seguridad, auditoría y sesiones activas

Está pensada para comercios con operación física, gestión por empleados y necesidad de escalar a múltiples sucursales o canales de venta.

---

## Funcionalidades principales

### Operación comercial

- **POS completo** con carrito, lector de código de barras, descuentos por ítem/global, múltiples medios de pago y anulación de ventas.
- **Caja por terminal física** con apertura/cierre de turnos y control por dispositivo.
- **Clientes, historial y saldo en cuenta** actualizados automáticamente según ventas y pagos.

### Inventario y logística interna

- **Stock dual**: disponible para venta vs. entregado en consignación.
- **Gestión multisucursal** con aislamiento de stock, caja, configuración y usuarios por sucursal.
- **Pedidos esperados** para programar ingresos futuros de mercadería con items, fechas y seguimiento de estado.
- **Gastos y finanzas** con comprobantes, recurrencia y distribución proporcional entre sucursales.

### Consignaciones

- **Flujo completo de consignación**: remito, folio secuencial, liquidaciones iterativas y devoluciones.
- **Ajustes automáticos de precio** para mercadería consignada.
- **Alertas por tiempo en calle** para detectar consignaciones demoradas.

### Tienda pública y canal online

- **Catálogo público por sucursal** con branding, temas, redes sociales y layout configurable.
- **Modo tienda** con carrito y checkout online.
- **Checkout configurable**: WhatsApp o Mercado Pago, según la sucursal.
- **Banners, slider, contenido storefront y analítica de visitas** para mejorar conversión.
- **Integración con Andreani** para cotización y gestión de envíos.

### IA y automatizaciones recientes

- **Carga de facturas de proveedor con IA/OCR** para extraer proveedor, comprobante e ítems.
- **Validación y corrección manual posterior** antes de confirmar los datos detectados.
- **Sugerencias desde catálogo global externo** como tercera fuente de matching cuando no hay coincidencias locales.
- **Rubro del negocio como contexto para OCR** para mejorar la precisión de interpretación.
- **Conversión de precios basada en dólar cripto/blue** para setup y planes.

### Reportes y compartición

- **Reportes PDF server-side** con Puppeteer: ticket, remito, inventario, historial, dashboard, POS y gastos.
- **Share links temporales y seguros** con expiración, hash, límite de vistas y redirección corta (`/x/[code]`).
- **Branding aplicado a reportes** con logo, colores y datos del negocio.

### Seguridad y administración

- **Auditoría de acciones administrativas**: altas, modificaciones y bajas de
  usuarios, productos, ventas anuladas, consignaciones y configuración general se
  registran en `AuditLog` con usuario, acción, módulo, IP y user agent. El resto
  de los módulos todavía no audita: ver `odd/mejoras-arquitectura/tasks.md` (M18).
- **Sesiones activas** con cierre remoto por dispositivo.
- **Rate limiting en auth**, recuperación de contraseña por email y monitoreo de seguridad.
- **Restricción por rol y horario laboral** para empleados.
- **Notificaciones en tiempo real** por stock, vencimientos, ventas y consignaciones.

### SaaS y suscripciones

- **Planes Básico, Pro y Enterprise** con límites y capacidades distintas.
- **Mercado Pago + PayPal** para cobro de suscripciones.
- **Auto-seeding de planes** si una instalación antigua no tiene la tabla inicializada.
- **Enterprise con OCR de facturas** y capacidad multisucursal.

---

## Novedades incorporadas en esta etapa

Estas son algunas de las mejoras nuevas que ya conviene reflejar en la documentación del producto:

- módulo de **facturas de proveedor con IA/OCR**
- integración opcional con **`catalogo-global-api`** como servicio externo para sugerencias de productos
- soporte de **zonas horarias configurables** en reportes, ventas e historial
- **pedidos esperados** como nuevo flujo operativo de abastecimiento
- expansión del canal online con **storefront content**, banners múltiples y modo de pago seleccionable
- mejoras de **seguridad y auditoría** con sesiones activas y monitoreo de accesos
- pricing y setup apoyados por **cotización de dólar cripto/blue**

---

## Stack tecnológico

| Capa          | Tecnología                                    |
| ------------- | --------------------------------------------- |
| Framework     | Next.js 16 (App Router)                       |
| UI            | React 19, Tailwind CSS 4, shadcn/ui, Radix UI |
| ORM / DB      | Prisma 7 + PostgreSQL (`@prisma/adapter-pg`)  |
| Servidor      | Node.js HTTP custom + `tsx` (`server.ts`)     |
| Tiempo real   | Socket.io 4                                   |
| Validación    | Zod + React Hook Form                         |
| Auth          | JWT (`jose`), bcryptjs, sesiones en DB        |
| Estado global | Zustand                                       |
| Reportes      | Puppeteer                                     |
| SaaS payments | MercadoPago + PayPal                          |
| Envíos        | Andreani                                      |
| Email         | Resend                                        |
| IA/OCR        | OpenRouter + Tesseract + validación custom    |
| Charts        | Recharts                                      |
| Lenguaje      | TypeScript 5                                  |

---

## Arquitectura resumida

### Servidor custom

`server.ts` levanta un servidor HTTP propio que:

1. integra Next.js y Socket.io en el mismo proceso
2. expone `/api/socket/dispatch` para emitir eventos desde route handlers
3. delega el resto del tráfico al handler de Next.js
4. escucha en `0.0.0.0` para despliegues cloud

### Estructura relevante

```text
consignacion-app/
├── prisma/                     # Schema, migraciones y seed
├── src/
│   ├── app/                    # App Router, API y vistas públicas/protegidas
│   ├── lib/                    # Servicios, auth, seguridad, IA, reportes, storefront
│   ├── modules/                # Dominio con límites explícitos
│   │   ├── ventas/             # Caso de uso + adaptador de persistencia (patrón de referencia)
│   │   ├── inventory/          # Autoridad de stock y transiciones
│   │   ├── consignaciones/     # Numeración de folios y liquidaciones
│   │   ├── finance/            # Cálculos de rentabilidad
│   │   ├── pricing/            # Markup de consignación
│   │   └── invoices/           # Configuración de extracción de facturas
│   ├── providers/              # Socket provider y toaster
│   ├── store/                  # Zustand
│   ├── hooks/                  # Hooks de negocio/UI
│   └── types/                  # Tipos compartidos
├── docs/                       # Documentación técnica
├── odd/                        # Especificaciones y decisiones por esfuerzo
└── server.ts                   # Servidor Next + Socket.io
```

> `src/modules/ventas/` es el patrón de referencia: caso de uso puro con
> dependencias inyectadas y un único adaptador que conoce Prisma. El resto de los
> módulos todavía no sigue ese molde; migrarlos es trabajo pendiente, no estado
> actual (ver `odd/mejoras-arquitectura/tasks.md`, M12).

> `catalogo-global-api` ya no vive dentro de este repositorio. `consignacion-app` lo consume como servicio externo vía `CATALOGO_API_URL`.

### Modelo de render

La aplicación es una **SPA montada sobre el App Router**: 42 de 47 páginas son
`"use client"` y hay un solo archivo `"use server"`. El acceso a datos ocurre en
el cliente contra los route handlers de `/api`, salvo el **catálogo público**
(`src/app/[slug]/page.tsx`), que sí renderiza en el servidor porque necesita SEO.

No hay Server Actions en uso. Esto no es un pendiente: es cómo está construido
hoy, y está registrado como decisión pendiente en
`odd/mejoras-arquitectura/tasks.md` (M06).

---

## Reglas de negocio importantes

- **Stock mínimo en 0** desactiva alertas de stock bajo para ese producto.
- **Ventas y consignaciones** preservan integridad histórica: no se eliminan productos con historial relevante.
- **Notificaciones** usan fingerprint para evitar duplicados.
- **Share links** se validan con hash, expiración y límites de acceso.
- **Vista global multisucursal** puede operar en modo solo lectura para ciertos módulos, como pedidos esperados.
- **OCR de facturas** no reemplaza revisión humana: la extracción puede corregirse antes de confirmar.

---

## Configuración

### Variables mínimas requeridas

| Variable               | Descripción                        |
| ---------------------- | ---------------------------------- |
| `DATABASE_URL`         | Conexión PostgreSQL                |
| `JWT_SECRET`           | Firma de tokens                    |
| `JWT_COOKIE_NAME`      | Cookie de sesión                   |
| `CRON_SECRET`          | Protección de cron endpoints       |
| `PDF_SECRET`           | Firma de links PDF                 |
| `SHARE_LINK_SECRET`    | Seguridad de share links           |
| `NEXT_PUBLIC_APP_URL`  | URL pública de la app              |
| `NEXT_PUBLIC_BASE_URL` | Base URL usada por socket/reportes |
| `APP_URL`              | Base URL del despacho interno de notificaciones |
| `SOCKET_DISPATCH_SECRET` | Secreto del endpoint `/api/socket/dispatch` (si falta, cae a `CRON_SECRET`) |

### Pagos SaaS

| Variable            | Descripción                           |
| ------------------- | ------------------------------------- |
| `MP_ACCESS_TOKEN`   | Access token del SaaS en Mercado Pago |
| `MP_PUBLIC_KEY`     | Public key Mercado Pago               |
| `MP_WEBHOOK_SECRET` | Validación de webhooks MP             |
| `PAYPAL_CLIENT_ID`  | Client ID PayPal                      |
| `PAYPAL_SECRET`     | Secret PayPal                         |
| `PAYPAL_WEBHOOK_ID` | Webhook ID PayPal                     |
| `PAYPAL_API_URL`    | Sandbox o live                        |

### Integraciones opcionales

| Variable                  | Descripción                            |
| ------------------------- | -------------------------------------- |
| `RESEND_API_KEY`          | Envío de emails                        |
| `DEFAULT_TRIAL_DAYS`      | Días de prueba                         |
| `CATALOGO_API_URL`        | URL del servicio `catalogo-global-api` |
| `CATALOGO_API_KEY`        | API key del catálogo global            |
| `CATALOGO_API_TIMEOUT_MS` | Timeout de matching global             |
| `UPLOAD_DIR`              | Directorio persistente para uploads    |

> Las credenciales de Mercado Pago de cada tienda pública se administran desde settings y no desde variables globales del deployment.

---

## Scripts útiles

```bash
npm run dev
npm run build
npm start
npm run seed
npm run lint
npm test                    # 62 archivos unitarios, sin base de datos
npm run test:integration    # 17 archivos; requiere TEST_DATABASE_URL
npm run test:all            # unitarios + integración
npm run security:audit
npm run security:scan-secrets-local
```

> `npm test` inyecta `DATABASE_URL` y `JWT_SECRET` descartables si no vienen del
> entorno, para que los unitarios no dependan de una base. Los de integración
> **fallan cerrado** sin `TEST_DATABASE_URL` porque ejecutan `TRUNCATE` sobre
> tablas reales y no deben poder apuntar a la base de desarrollo por accidente.

### Notas de build y producción

- `npm run build` genera Prisma Client y compila Next.js.
- `npm start` sólo levanta el servidor; no ejecuta migraciones.
- Las migraciones se despliegan en una ventana controlada y separada del arranque.
- La reparación T11 usa `npm run migrate:t11:deploy`; su preflight rechaza estados
  parciales desconocidos. Ver
  `odd/evolucion-arquitectura-backend/migration-repair.md`.

---

## Módulos destacados para usuarios y equipos

- **Dashboard** con KPIs y reportes exportables.
- **Productos e inventario** con stock, descuentos y categorías/subcategorías.
- **Consignaciones** con remitos y liquidaciones.
- **POS y caja** por terminal.
- **Seguridad** con auditoría, empleados y sesiones.
- **WhatsApp** con plantillas dinámicas.
- **Tienda online** con branding, banners y checkout.
- **Suscripciones** con historial de facturación.
- **Setup inicial** guiado para dejar operativo el comercio.

---

## Documentación complementaria

- [docs/INDEX.md](./docs/INDEX.md)
- [docs/DOCUMENTACION.md](./docs/DOCUMENTACION.md)
- [docs/GUIA_TECNICA_PROYECTO.md](./docs/GUIA_TECNICA_PROYECTO.md)
- [docs/API_REFERENCIA_TECNICA.md](./docs/API_REFERENCIA_TECNICA.md)
- [docs/ADR/0001-servidor-custom-next-socketio.md](./docs/ADR/0001-servidor-custom-next-socketio.md)

---

## Estado del producto

El proyecto ya cubre un escenario operativo avanzado con venta física y canal online sobre una instalación por comercio. La evolución reciente apunta a:

- más automatización operativa
- más seguridad y trazabilidad
- más personalización para storefront
- más capacidades enterprise con IA/OCR e integraciones externas

El estado de la deuda técnica y arquitectónica está en
`odd/mejoras-arquitectura/tasks.md`, con las tareas priorizadas y su evidencia.
