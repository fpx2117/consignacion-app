# Sistema Integral de Gestión POS & Consignaciones (B2B SaaS)

Este repositorio contiene el código de un sistema de gestión comercial robusto (*Fullstack*), construido con **Next.js**, **React**, **Tailwind CSS**, **Prisma ORM** y **PostgreSQL**. El sistema está diseñado para manejar ventas directas (POS), gestión de stock por sucursales y un flujo completo de mercancía en consignación, operando bajo un modelo de suscripción (SaaS).

## 🚀 Características Principales

* **Plataforma Multi-Sucursal (Multi-tenant):** Cuentas aisladas por sucursal con sistema de roles (`ADMIN`, `EMPLEADO`).
* **Control de Stock Dual:** Seguimiento diferenciado entre stock físicamente disponible y stock entregado en consignación en la calle.
* **Módulo de Consignaciones:** Flujo completo desde la entrega de mercancía hasta la liquidación paso a paso y devolución.
* **Catálogo Público y Enlaces (Tienda):** Posibilidad de activar una tienda en línea pública para que los clientes vean el stock. Generación de URLs compartibles (Remitos, Tickets).
* **Gestión de Gastos y Finanzas:** Control de caja (`SesionCaja`), egresos y sistema de pagos recurrentes (cuotas automatizadas).
* **Central de Notificaciones:** Alertas automáticas por stock bajo, productos vencidos, y recepciones de dinero.
* **Modelo SaaS (Suscripciones):** Cobro de membresías comerciales a las tiendas, integrado con MercadoPago y PayPal.

---

## 🏗️ Arquitectura de Datos

### Modelos de Inventario y Empresa
* **`Sucursal` / `Branding`**: Define el comercio, su apariencia (Colores, Logos, Banners) y agrupa sus entidades.
* **`Producto` / `StockSucursal`**: El núcleo del catálogo, controla precios, categorías y umbrales de stock independientes por local.

### Flujo de Consignación
1.  **`Consignacion`**: Agrupa el proceso de entrega de mercadería a un cliente bajo un `numeroFolio`.
2.  **`ConsignacionDetalle`**: Registra las unidades entregadas, vendidas acumuladas y devueltas.
3.  **`Liquidacion`**: El evento donde se rinden cuentas de lo vendido en una consignación abierta.

### Finanzas (Caja, Gastos y Ventas)
* **`Venta` & `VentaDetalle`**: Registro de ingresos ya sea de forma directa en sucursal o derivados de devoluciones.
* **`SesionCaja` & `MovimientoCaja`**: Turnos de ventas de empleados controlando el arqueo de billetes físicos.
* **`Gasto` & `CategoriaGasto`**: Rastreo del flujo de salida de dinero, incluyendo facturas recurrentes programadas.
* **`Cliente` & `Pago`**: Cuentas corrientes (saldo a favor/deuda) de compradores frecuentes.

### Infraestructura SaaS (Sistema)
* **`Subscription` & `Plan`**: Controla el estado del cobro mensual de la licencia a las sucursales, limitando acceso.
* **`Notification`**: Gestiona las alertas *in-app* y por mail sobre métricas críticas del local.
* **`ShareLink`**: Visores web estáticos generados temporalmente para enviar tickets sin usar cuentas de usuario.

---

## 🛠️ Stack Tecnológico

* **Framework:** Next.js 15 (App Router)
* **Librería UI:** React 19, Tailwind CSS, Shadcn UI
* **Motor de Base de Datos:** PostgreSQL
* **ORM:** Prisma Client
* **Procesamiento de Pagos:** Mercado Pago (Webhooks & Checkout Pro), PayPal
* **Lenguaje:** TypeScript
* **Herramientas Adicionales:** Recharts, React Hook Form, Zod.

---

## 📋 Reglas de Negocio Implementadas

| Concepto | Regla de Datos |
| :--- | :--- |
| **Stock Mínimo** | Si `stockMinUnits` es 0, las notificaciones automáticas están desactivadas. |
| **Folios** | Índice compuesto en `[clienteId, numeroFolio]` para rastrear entregas cronológicas por cliente. |
| **Saldos** | El campo `saldoCuenta` en `Cliente` centraliza la deuda total pendiente de cobro. |
| **Integridad** | Uso de `onDelete: Restrict` en productos para evitar pérdida de historial en ventas o consignaciones. |

---

## ⚙️ Configuración del Proyecto

A continuación, los pasos para desplegar el proyecto localmente:

### 1. Clonar el Repositorio

```bash
git clone https://github.com/tu-usuario/consignacion-app.git
cd consignacion-app
```

### 2. Instalar Dependencias

Asegúrate de tener Node.js instalado (v18+ recomendado).
```bash
npm install
```

### 3. Configurar Variables de Entorno

Duplica el archivo `.env.example` y renómbralo a `.env`:
```bash
cp .env.example .env
```
Actualiza las credenciales dentro de tu `.env`:
*   `DATABASE_URL`: URI de conexión a PostgreSQL.
*   `NEXTAUTH_SECRET`: Secreto criptográfico para las sesiones de Auth.js.
*   `MP_ACCESS_TOKEN` / `PAYPAL_CLIENT_ID`: Credenciales para los gateways de pago SaaS.

### 4. Configurar la Base de Datos

Ejecuta las migraciones de Prisma para generar las tablas en tu base de datos:
```bash
npx prisma generate
npx prisma db push
```

**(Opcional)** Para poblar la base de datos con datos semilla de prueba (Usuarios admin, configuración, planes base):
```bash
npx prisma db seed
```

### 5. Iniciar el Entorno de Desarrollo

```bash
npm run dev
```
La aplicación estará disponible en `http://localhost:3000`.

### 6. Construcción para Producción

Para compilar el proyecto optimizado:
```bash
npm run build
npm start
```