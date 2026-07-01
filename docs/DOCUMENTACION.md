# Documentación Funcional y Modelo de Datos

Este documento detalla la **funcionalidad principal** del sistema, el **mapa de rutas de frontend** y el **modelo de datos** (entidades + enums) entidad por entidad.

> Para stack tecnológico, arquitectura y seguridad ver [GUIA_TECNICA_PROYECTO.md](./GUIA_TECNICA_PROYECTO.md).
> Para el contrato detallado de cada endpoint (request/response/errores) ver [API_REFERENCIA_TECNICA.md](./API_REFERENCIA_TECNICA.md).

---

## Funcionalidad Principal

El sistema es una solución integral para la gestión de puntos de venta (POS) con un fuerte enfoque en el modelo de **Consignaciones**, permitiendo a los comerciantes gestionar mercadería entregada a terceros sin venta inmediata.

### Gestión de Inventario
- **Multisucursal**: El stock se gestiona de forma aislada por sucursal mediante `StockSucursal`. Soporta precios de venta y costo por sucursal (`precioVentaOverride`, `precioCostoOverride`).
- **Vencimientos**: Control y alertas automáticas de productos próximos a vencer.
- **Categorización**: Organización de productos por categorías y **subcategorías** (marcas), con **descuentos por nivel de cantidad** definidos a nivel de subcategoría (`descuentos: Json` en `Subcategoria`).
- **Movimientos de Stock**: Registro histórico de entradas, salidas, ajustes, roturas, pérdidas, devoluciones y transferencias por consignación.
- **Código de barras / SKU**: Búsqueda y unicidad garantizada por sucursal.
- **Imagen de producto**: Almacenada via URL (`imagenUrl`).

### Punto de Venta (POS) y Caja
- **Ventas Rápidas**: Terminal de venta con carrito, selección de cliente, descuento global por venta y por ítem.
- **Anulación de ventas**: Las ventas pueden anularse con motivo; los ítems pueden marcarse como rotura (`esRotura`).
- **Control de Caja**: Sesiones de caja con apertura (monto inicial), movimientos (ingresos/egresos manuales) y cierre con auditoría de diferencias.
- **Métodos de Pago**: Efectivo, Transferencia, Tarjeta y Otro. El interés de tarjeta es configurable.
- **Tickets compartibles**: Generación de links públicos temporales para que el cliente vea su ticket sin necesidad de cuenta.

### Consignaciones
- **Flujo Completo**: Creación de remitos con folio secuencial por cliente (ej: Pedro #1, Pedro #2), seguimiento de unidades "en la calle" y liquidación parcial o total.
- **Porcentaje de Aumento**: Cada consignación puede aplicar un recargo configurable sobre el precio de venta.
- **Liquidaciones**: Proceso iterativo donde se informa qué se vendió y qué se devuelve; genera una venta vinculada que actualiza el saldo del cliente.
- **Remitos Digitales**: Generación de links compartibles (`ShareLink`) para que los clientes vean sus remitos sin necesidad de cuenta.
- **Edición**: Las consignaciones y liquidaciones pueden editarse después de creadas.
- **Cron de alertas**: Tarea automática que notifica consignaciones sin actividad reciente.

### Clientes y Cuentas Corrientes
- **Datos completos**: Nombre, email, documento, teléfono, dirección, provincia, localidad, código postal.
- **Saldo deudor**: Seguimiento de deuda por cliente (`saldoCuenta`, positivo = debe).
- **Pagos y Recibos**: Registro de pagos a cuenta para reducir saldos, con método de pago y sesión de caja asociada.
- **Historial por cliente**: Vista detallada de ventas, consignaciones y pagos desde el perfil del cliente.

### Gastos y Finanzas
- **Registro de Egresos**: Gestión de pagos con subida de comprobante opcional.
- **Gastos Recurrentes**: Creación de series de cuotas con frecuencia única, semanal, mensual o anual. Las cuotas comparten un `recurrenciaId`.
- **Estados**: `PENDIENTE` / `PAGADO`.
- **Gastos Compartidos**: Un gasto puede distribuirse proporcionalmente entre múltiples sucursales mediante `GastoSucursal`.
- **Comprobantes compartibles**: Link público temporal para ver el comprobante adjunto a un gasto.

### Tienda Pública y Catálogo
- **Vista al Público**: Los comercios pueden activar una URL pública (`/lista`) para mostrar su inventario.
- **Personalización de Marca (`Branding`)**: Nombre del negocio, colores primario y secundario, logo, banner único o **carrusel de banners** (`BrandingBanner`), texto de pie de página, teléfono y dirección.
- **Temas visuales**: Selector de `themeIdentifier` para cambiar la apariencia de la tienda.
- **Redes sociales**: URLs de Facebook, Instagram y número de WhatsApp con mensaje personalizable por producto.
- **Layout configurable**: Vista grilla o lista (`tiendaLayout`). Categorías en el header de la tienda (`mostrarCategoriasEnHeader`).
- **Separación por sucursal**: El catálogo puede mostrarse unificado o filtrado por sucursal.
- **Checkout con envío**: Integración con MercadoPago para pagos en la tienda pública, cotización de envíos via **Andreani** (domicilio o sucursal).

### Reportes y Documentos PDF
- **Generados con Puppeteer** del lado del servidor.
- Ticket de venta, Remito de consignación, Inventario, Historial de inventario, Reporte POS, Reporte de Dashboard, Reporte de Consignación, Comprobante de gasto.
- Cada reporte puede compartirse via un `ShareLink` con vistas limitadas y expiración.
- Cada reporte tiene una ruta de vista HTML (`/ver/*`) y su PDF descargable (`/ver/*/pdf`).

### Notificaciones y Tiempo Real
- **Socket.io**: Servidor custom que emite eventos a los clientes conectados.
- **Central de Alertas**: Avisos sobre stock bajo, stock agotado, vencimientos próximos/ocurridos, nuevas órdenes, pagos recibidos/fallidos, estado de suscripción, alertas de consignaciones activas y liquidaciones.
- **Huella dactilar (`fingerprint`)**: Previene la creación de notificaciones duplicadas.
- **Lectura masiva**: Las notificaciones pueden marcarse como leídas individualmente o en bloque.

### Seguridad y Auditoría
- **Sesiones de usuario (`UserSession`)**: Registro de cada login con IP, user agent, navegador, OS, dispositivo, ciudad y país. Permite ver y revocar sesiones activas.
- **Registro de auditoría (`AuditLog`)**: Log de acciones por usuario, módulo y detalles en JSON.
- **Horarios laborales**: Restricción de acceso por día y franja horaria por empleado.
- **Recuperación de clave**: Flujo completo via email con token de expiración (`ResetPasswordToken`).
- **Roles**: `ADMIN` y `EMPLEADO`.

### SAAS y Suscripciones
- **Planes (`Plan`, `PlanLimit`)**: Límites configurables de productos, usuarios, acceso a consignaciones y multisucursal.
- **Proveedores**: MercadoPago (suscripción recurrente) y PayPal.
- **Códigos promocionales (`PromoCode`)**: Acceso temporal a un plan, con límite de usos y expiración.
- **Estados de suscripción**: `PRUEBA`, `ACTIVO`, `ATRASADO`, `CANCELADO`, `INCOMPLETO`, `VENCIDO`.
- **Webhooks**: Recepción de notificaciones de pago de MercadoPago y PayPal para actualizar estados automáticamente.
- **Cron**: Verificación periódica de vencimientos de suscripción y actualización de precios de planes.

### Configuración por Sucursal
El modelo `Configuracion` (uno por sucursal) centraliza todos los parámetros operativos:
- Stock mínimo global, días de anticipación de vencimiento.
- Activación de notificaciones (stock, vencimientos, ventas, consignaciones, liquidaciones).
- Control de caja obligatorio.
- Porcentaje de aumento de consignación y de interés de tarjeta.
- Opciones de tienda pública (mostrar precios, layout, separar por sucursal, MercadoPago de tienda).
- Mensajes de WhatsApp para consignación y ventas.
- Credenciales de **Andreani** (contrato domicilio, contrato sucursal, usuario, contraseña).

---

## Mapa de Rutas (Diagrama)

```mermaid
graph TD
    subgraph "Acceso"
        S[Setup inicial] --> L[Login]
        FP[Forgot Password] --> RP[Reset Password] --> L
        L --> D[Dashboard]
    end

    subgraph "Operativa Diaria"
        D --> V[Ventas]
        D --> C[Consignaciones]
        D --> P[Productos]
        D --> CL[Clientes]
        D --> CA[Caja]
        D --> G[Gastos]
        D --> LIQ[Liquidaciones]
    end

    subgraph "Ventas"
        V --> NV[Nueva Venta]
        V --> DV[Detalle Venta / Anulación]
    end

    subgraph "Consignaciones"
        C --> NC[Nueva Consignación]
        C --> DC[Detalle / Editar]
        DC --> LC[Liquidar]
        LC --> EL[Editar Liquidación]
    end

    subgraph "Caja"
        CA --> AB[Abrir Caja]
        CA --> CI[Cerrar Caja]
        CA --> HI[Historial Cajas]
    end

    subgraph "Finanzas"
        G --> NG[Registrar Gasto]
    end

    subgraph "Acceso Público"
        PU[Visitante] --> TI[/lista — Tienda Pública]
        SL[ShareLink /x/code] --> VR[Visor: ticket, remito, inventario, reporte...]
        VR --> PDF[PDF descargable]
    end

    subgraph "Ajustes"
        D --> SET[Settings]
        SET --> BR[Sucursales]
        SET --> BRD[Branding / Tienda]
        SET --> SEC[Seguridad / Empleados / Sesiones / Actividad]
        SET --> SUB[Planes y Suscripción]
        SET --> NOT[Notificaciones]
        SET --> POS[POS / Horarios]
        SET --> WA[WhatsApp]
        SET --> USR[Usuarios]
    end
```

---

## Detalle de Rutas

### Frontend (Interfaz de Usuario)

| Ruta | Función |
| :--- | :--- |
| `/login` | Autenticación con email y contraseña. |
| `/forgot-password` | Solicitud de reset de clave por email. |
| `/reset-password` | Formulario para definir nueva clave con token. |
| `/setup` | Wizard de configuración inicial (crear cuenta, elegir plan). |
| `/dashboard` | Resumen de KPIs, ventas del día, stock bajo, gráficos de tendencia y top productos. |
| `/ventas/nueva` | Terminal POS con carrito, lector de código de barras, selección de cliente y método de pago. |
| `/ventas/[id]` | Detalle de una venta, con opción de anulación y generación de ticket. |
| `/consignaciones` | Listado de consignaciones con filtros por estado. |
| `/consignaciones/nueva` | Formulario para entregar mercadería en consignación. |
| `/consignaciones/[id]` | Detalle de consignación: unidades entregadas, vendidas, devueltas y estado. |
| `/consignaciones/[id]/editar` | Edición de una consignación existente. |
| `/consignaciones/[id]/liquidar` | Interfaz para reportar qué se vendió y qué se devuelve de una consignación. |
| `/liquidaciones/[id]/editar` | Edición de una liquidación ya registrada. |
| `/caja/abrir` | Inicio de jornada con monto inicial de caja. |
| `/caja/cerrar` | Cierre de sesión de caja con conteo real y observaciones. |
| `/caja/historial` | Historial de sesiones de caja pasadas. |
| `/productos` | Listado, filtros por categoría, gestión de stock y ajustes. |
| `/clientes` | Gestión de clientes: CRUD y saldo de cuenta corriente. |
| `/clientes/[id]` | Perfil del cliente con historial de ventas, consignaciones y pagos. |
| `/gastos` | Seguimiento de egresos, categorías y cuotas recurrentes. |
| `/settings` | Hub de configuraciones de la cuenta. |
| `/settings/branches` | Gestión de sucursales. |
| `/settings/branding` | Configuración de marca (logo, colores, banner). |
| `/settings/tienda` | Personalización de tienda pública: temas, layout, redes sociales. |
| `/settings/notifications` | Configuración de alertas y umbrales. |
| `/settings/pos` | Ajustes del POS (cajas, horarios de empleados). |
| `/settings/pos/horarios` | Gestión de horarios laborales por empleado. |
| `/settings/security` | Resumen de seguridad. |
| `/settings/security/employees` | Alta, baja y modificación de empleados. |
| `/settings/security/sessions` | Lista de sesiones activas del usuario, con opción de revocar. |
| `/settings/security/activity` | Log de auditoría de acciones del usuario. |
| `/settings/subscriptions` | Estado del plan actual, tabla de precios y proceso de pago. |
| `/settings/users` | Gestión de usuarios del sistema. |
| `/settings/whatsapp` | Configuración de mensajes de WhatsApp automáticos. |
| `/lista` | Catálogo público (tienda) accesible sin login. |
| `/x/[code]` | Redireccionador de ShareLinks (valida hash, incrementa vistas y redirige). |
| `/ticket-loading/[id]` | Página intermedia mientras se genera el PDF del ticket. |
| `/consignacion-loading/[id]` | Página intermedia mientras se genera el PDF del remito. |
| `/ver/ticket/[id]` | Visor HTML del ticket de venta. |
| `/ver/remito/[id]` | Visor HTML del remito de consignación. |
| `/ver/inventario/[id]` | Visor HTML del reporte de inventario. |
| `/ver/inventario/[id]/pdf` | PDF descargable del reporte de inventario. |
| `/ver/historial/[id]` | Visor HTML del historial de movimientos de inventario. |
| `/ver/historial/[id]/pdf` | PDF descargable del historial de inventario. |
| `/ver/dashboard/[period]` | Visor HTML del reporte de dashboard. |
| `/ver/dashboard/[period]/pdf` | PDF descargable del reporte de dashboard. |
| `/ver/pos/[period]` | Visor HTML del reporte de ventas POS. |
| `/ver/pos/[period]/pdf` | PDF descargable del reporte POS. |
| `/ver/consig/[period]` | Visor HTML del reporte de consignaciones. |
| `/ver/consig/[period]/pdf` | PDF descargable del reporte de consignaciones. |
| `/ver/gasto/[id]` | Visor del comprobante de un gasto. |

### API (Backend — Next.js Route Handlers)

> Contrato completo de cada endpoint (auth, body, respuesta de éxito y errores) en [API_REFERENCIA_TECNICA.md](./API_REFERENCIA_TECNICA.md). A continuación, listado rápido por dominio:

#### Autenticación
| Endpoint | Descripción |
| :--- | :--- |
| `POST /api/auth/login` | Login con email/contraseña. Crea `UserSession`. |
| `POST /api/auth/logout` | Cierra sesión actual. |
| `GET /api/auth/me` | Devuelve el usuario autenticado y su configuración. |
| `POST /api/auth/forgot-password` | Envía email de recuperación de clave. |
| `POST /api/auth/reset-password` | Aplica nueva clave con token. |
| `POST /api/auth/setup-auth` | Setup inicial: crea el primer usuario administrador. |

#### Dashboard
| Endpoint | Descripción |
| :--- | :--- |
| `GET /api/dashboard/kpi` | KPIs: consignaciones, unidades, stock, finanzas y gastos por período. |
| `GET /api/dashboard/tendencia` | Serie temporal de ventas, pagos y consignaciones. |
| `GET /api/dashboard/top-productos` | Top productos más vendidos y más consignados. |
| `GET /api/dashboard/consignaciones` | Consignaciones prioritarias y últimas liquidaciones. |
| `POST /api/dashboard/reporte-link` | Genera un `ShareLink` para el reporte de dashboard. |

#### Productos y Categorías
| Endpoint | Descripción |
| :--- | :--- |
| `GET/POST /api/productos` | Listado y creación de productos. |
| `GET/PUT/DELETE /api/productos/[id]` | CRUD individual de producto. |
| `GET /api/productos/barcode/[code]` | Búsqueda de producto por código de barras. |
| `POST /api/productos/inventario-link` | Genera un `ShareLink` para el reporte de inventario. |
| `GET/POST /api/categorias` | Listado y creación de categorías. |
| `PUT/DELETE /api/categorias/[id]` | Edición y eliminación de categoría. |

#### Ventas
| Endpoint | Descripción |
| :--- | :--- |
| `GET/POST /api/ventas` | Listado y creación de ventas directas (POS). |
| `GET/PUT /api/ventas/[id]` | Detalle y anulación de una venta. |
| `POST /api/ventas/[id]/ticket-link` | Genera un `ShareLink` para el ticket. |

#### Consignaciones y Liquidaciones
| Endpoint | Descripción |
| :--- | :--- |
| `GET/POST /api/consignaciones` | Listado y creación de consignaciones. |
| `GET/PUT/DELETE /api/consignaciones/[id]` | Detalle, edición y eliminación. |
| `POST /api/consignaciones/[id]/remito-link` | Genera un `ShareLink` para el remito. |
| `GET/POST /api/liquidaciones` | Listado y creación de liquidaciones. |
| `GET/PUT /api/liquidaciones/[id]` | Detalle y edición de una liquidación. |
| `GET /api/liquidaciones/consignacion/[consignacionId]` | Liquidaciones de una consignación específica. |

#### Clientes y Pagos
| Endpoint | Descripción |
| :--- | :--- |
| `GET/POST /api/clientes` | Listado y creación de clientes. |
| `GET/PUT/DELETE /api/clientes/[id]` | CRUD individual de cliente. |
| `GET /api/clientes/[id]/estado-cuenta` | Saldo, ventas y pagos del cliente. |
| `GET/POST /api/clientes/[id]/pagos` | Historial y registro de pagos a cuenta. |
| `GET /api/pagos/[clienteId]` | Todos los pagos de un cliente. |
| `POST /api/pagos` | Registro de pago a deuda. |

#### Caja
| Endpoint | Descripción |
| :--- | :--- |
| `GET/POST /api/settings/pos/cajas` | Listado de cajas y apertura de sesión. |
| `POST /api/settings/pos/cajas/cerrar` | Cierre de sesión de caja. |
| `GET /api/settings/pos/cajas/turno` | Turno activo del usuario actual. |
| `GET /api/settings/pos/cajas/historial` | Historial de sesiones cerradas. |

#### Gastos
| Endpoint | Descripción |
| :--- | :--- |
| `GET/POST /api/gastos` | Listado y creación de gastos (simples o recurrentes en lote). |
| `GET/PUT/DELETE /api/gastos/[id]` | Detalle, edición y eliminación de un gasto. |
| `POST /api/gastos/[id]/comprobante-link` | Genera un `ShareLink` para el comprobante del gasto. |
| `GET/POST /api/gastos/categorias` | Listado y creación de categorías de gasto. |
| `PUT/DELETE /api/gastos/categorias/[id]` | Edición y eliminación de categoría de gasto. |

#### Historial de Inventario
| Endpoint | Descripción |
| :--- | :--- |
| `GET /api/historial` | Movimientos de stock con filtros. |
| `GET /api/historial/anios` | Años disponibles en el historial. |
| `GET /api/historial/[id]` | Detalle de un movimiento. |
| `POST /api/historial/[id]/historial-link` | Genera un `ShareLink` para el reporte de historial. |

#### Archivos
| Endpoint | Descripción |
| :--- | :--- |
| `POST /api/upload` | Subida de archivos (comprobantes de gastos, imágenes). |
| `GET /api/files/[...path]` | Servicio de archivos subidos. |

#### Notificaciones
| Endpoint | Descripción |
| :--- | :--- |
| `GET /api/notificaciones` | Lista de notificaciones del usuario. |
| `POST /api/notificaciones/create` | Crea una notificación manualmente. |
| `POST /api/notificaciones/[id]/read` | Marca una notificación como leída. |
| `POST /api/notificaciones/read-all` | Marca todas las notificaciones como leídas. |
| `DELETE /api/notificaciones` | Elimina notificaciones leídas. |

#### Seguridad
| Endpoint | Descripción |
| :--- | :--- |
| `GET /api/security/sessions` | Sesiones activas del usuario. |
| `DELETE /api/security/sessions` | Revoca una sesión específica. |
| `GET /api/security/activity` | Log de auditoría de acciones del usuario. |

#### Settings
| Endpoint | Descripción |
| :--- | :--- |
| `GET/PUT /api/settings/general` | Configuración operativa de la sucursal. |
| `GET/PUT /api/settings/branding` | Datos de marca (colores, textos, redes, WhatsApp). |
| `GET /api/settings/branding/logo` | Descarga del logo actual. |
| `POST /api/settings/branding/logo/upload` | Subida de logo y banners. |
| `GET/POST /api/settings/sucursales` | Listado y creación de sucursales. |
| `PUT/DELETE /api/settings/sucursales/[id]` | Edición y eliminación de sucursal. |
| `GET/POST /api/settings/users` | Listado y creación de usuarios/empleados. |
| `GET/PUT /api/settings/pos/horarios` | Horarios laborales de los empleados. |
| `GET /api/settings/plan-limits` | Límites del plan activo para la sucursal. |

#### Suscripciones
| Endpoint | Descripción |
| :--- | :--- |
| `GET /api/subscriptions/plans` | Lista de planes disponibles. |
| `GET /api/subscriptions/current` | Suscripción actual del usuario. |
| `POST /api/subscriptions/mercadopago/create` | Inicia checkout de suscripción MP. |
| `POST /api/subscriptions/paypal/create` | Inicia checkout de suscripción PayPal. |
| `POST /api/subscriptions/cancel` | Cancela la suscripción al final del período. |
| `POST /api/subscriptions/promo/redeem` | Canjea un código promocional. |

#### Tienda Pública / Acceso Anónimo
| Endpoint | Descripción |
| :--- | :--- |
| `GET /api/public/lista-precios` | Catálogo de productos para la tienda pública. |
| `POST /api/public/checkout` | Crea preferencia de pago MercadoPago desde la tienda. |
| `POST /api/public/envios/cotizar` | Cotización de envío Andreani para una dirección. |

#### Setup inicial
| Endpoint | Descripción |
| :--- | :--- |
| `GET /api/setup/status` | Estado del wizard de configuración. |
| `POST /api/setup/initialize` | Ejecuta la inicialización del sistema. |
| `POST /api/setup/create-preference` | Crea preferencia de pago para el setup. |
| `POST /api/setup/create-mp-subscription` | Crea suscripción MP durante el setup. |
| `POST /api/setup/create-paypal` | Crea suscripción PayPal durante el setup. |
| `POST /api/setup/validate-promo` | Valida un promo code durante el setup. |

#### Webhooks y Tareas Automáticas (Cron)
| Endpoint | Descripción |
| :--- | :--- |
| `POST /api/webhooks/mercadopago` | Recibe notificaciones de pago de MercadoPago. |
| `POST /api/webhooks/paypal` | Recibe notificaciones de pago de PayPal. |
| `GET /api/cron/check-vencimientos` | Verifica productos próximos a vencer y genera notificaciones. |
| `GET /api/cron/check-subscriptions` | Verifica estado de suscripciones y notifica expiración. |
| `GET /api/cron/consignaciones` | Alerta sobre consignaciones activas sin actividad reciente. |
| `GET /api/cron/update-subscription-prices` | Actualiza precios de planes en MercadoPago/PayPal. |

---

## Modelo de Datos

El sistema utiliza **Prisma ORM 7** con **PostgreSQL**. A continuación se describen todas las entidades y sus relaciones clave.

### Autenticación y Usuarios

| Modelo | Descripción |
| :--- | :--- |
| `Usuario` | Usuario del sistema. Roles: `ADMIN` / `EMPLEADO`. Vinculado opcionalmente a una sucursal. |
| `UserSession` | Sesión activa de un usuario: token JWT, IP, user agent, navegador, OS, dispositivo, ciudad, país. |
| `HorarioLaboral` | Restricciones de acceso por día de la semana y franja horaria, por empleado. |
| `AuditLog` | Registro de auditoría: acción, módulo, detalles JSON, IP y user agent. |
| `ResetPasswordToken` | Token temporal para el flujo de recuperación de contraseña. |

### Sucursales y Configuración

| Modelo | Descripción |
| :--- | :--- |
| `Sucursal` | Eje del modelo multi-tenant. Todas las entidades operativas se aíslan por sucursal. |
| `Configuracion` | Parámetros operativos por sucursal: stock mínimo, notificaciones, caja, consignación, tienda, Andreani. |
| `Branding` | Identidad visual de la sucursal: colores, logo, banner, textos, redes sociales, WhatsApp. |
| `BrandingBanner` | Imágenes individuales del carrusel de banners de una sucursal. |

### Inventario

| Modelo | Descripción |
| :--- | :--- |
| `Producto` | Artículo con nombre, precios (venta/costo), IVA, stock, stock mínimo, código de barras, SKU, imagen y vencimiento. |
| `StockSucursal` | Stock disponible y consignado por producto y sucursal. Permite precios de venta/costo sobreescritos por sucursal. |
| `Categoria` | Agrupador principal de productos con color identificativo. |
| `Subcategoria` | Agrupador secundario (ej: Marca) vinculado a una categoría. Define los **descuentos por nivel de cantidad** (`descuentos: Json` → `[{cantidadMin, porcentaje}]`). |
| `MovimientoStock` | Registro histórico de cada cambio de stock: tipo (ENTRADA/SALIDA), motivo, stock previo y posterior. |

### Punto de Venta y Caja

| Modelo | Descripción |
| :--- | :--- |
| `Venta` | Transacción de venta. Tipos: `CASUAL` (POS) o `LIQUIDACION` (generada al liquidar una consignación). Soporta anulación. |
| `VentaDetalle` | Ítem de una venta: producto, unidades, precio, descuento, subtotal. Puede marcarse como rotura. |
| `Envio` | Envío asociado a una venta: estado, código de seguimiento, costo, método (DOMICILIO/SUCURSAL), snapshot de dirección. |
| `Caja` | Caja física o virtual de una sucursal. |
| `SesionCaja` | Sesión de trabajo: monto inicial, monto final esperado, monto real declarado y diferencia. |
| `MovimientoCaja` | Ingreso o egreso manual dentro de una sesión de caja. |

### Consignaciones

| Modelo | Descripción |
| :--- | :--- |
| `Consignacion` | Remito de entrega de mercadería a un cliente. Tiene un folio secuencial por cliente. Estado: `ABIERTA` / `CERRADA`. |
| `ConsignacionDetalle` | Línea de producto en una consignación: unidades entregadas, vendidas acumuladas, devueltas acumuladas. |
| `Liquidacion` | Evento de liquidación parcial o total de una consignación. Genera una `Venta` vinculada. |
| `LiquidacionItem` | Detalle de una liquidación: unidades vendidas y devueltas por ítem, con snapshot de precio. |

### Clientes y Pagos

| Modelo | Descripción |
| :--- | :--- |
| `Cliente` | Datos completos del cliente y saldo de cuenta corriente (`saldoCuenta > 0` significa deuda). |
| `Pago` | Pago a cuenta de un cliente. Tipo: `VENTA` o `DEUDA`. |

### Gastos

| Modelo | Descripción |
| :--- | :--- |
| `Gasto` | Egreso con monto, motivo, categoría, estado y soporte para recurrencia (`recurrenciaId` agrupa cuotas). |
| `GastoSucursal` | Distribución proporcional de un gasto compartido entre múltiples sucursales. |
| `CategoriaGasto` | Categoría de gasto por sucursal. |

### SAAS y Suscripciones

| Modelo | Descripción |
| :--- | :--- |
| `Plan` | Plan de suscripción con precio en ARS y USD, y referencias a MercadoPago/PayPal. |
| `PlanLimit` | Límites del plan: máx. productos, máx. usuarios, acceso a consignaciones y multisucursal. |
| `Subscription` | Suscripción activa de un usuario: proveedor, estado, fechas de prueba y período actual. |
| `PromoCode` | Código promocional con duración en días, límite de usos y expiración. |

### Sistema y Utilidades

| Modelo | Descripción |
| :--- | :--- |
| `Notification` | Alerta interna con tipo, título, descripción, huella dactilar para deduplicación y estado de lectura. |
| `ShareLink` | URL pública temporal: tipo (ticket, remito, inventario, historial, reporte, comprobante), vistas máximas y hash de acceso. |

### Enumeraciones

| Enum | Valores |
| :--- | :--- |
| `RolUsuario` | `ADMIN`, `EMPLEADO` |
| `EstadoConsignacion` | `ABIERTA`, `CERRADA` |
| `EstadoSesionCaja` | `ABIERTA`, `CERRADA` |
| `EstadoGasto` | `PENDIENTE`, `PAGADO` |
| `FrecuenciaGasto` | `UNICO`, `SEMANAL`, `MENSUAL`, `ANUAL` |
| `TipoVenta` | `CASUAL`, `LIQUIDACION` |
| `MetodoPago` | `EFECTIVO`, `TRANSFERENCIA`, `TARJETA`, `OTRO` |
| `TipoMovimientoCaja` | `INGRESO`, `EGRESO` |
| `TipoMovimientoStock` | `ENTRADA`, `SALIDA` |
| `MotivoMovimientoStock` | `COMPRA`, `DEVOLUCION_CLIENTE`, `AJUSTE_POSITIVO`, `AJUSTE_NEGATIVO`, `ROTURA`, `VENCIMIENTO`, `PERDIDA`, `VENTA`, `CONSIGNACION` |
| `ShareLinkType` | `TICKET`, `REMITO`, `INVENTARIO`, `HISTORIAL_INVENTARIO`, `REPORTE_DASHBOARD`, `REPORTE_POS`, `REPORTE_CONSIGNACION`, `COMPROBANTE_GASTO` |
| `NotificationType` | `LOW_STOCK`, `OUT_OF_STOCK`, `SYSTEM`, `EXPIRATION_NEAR`, `PRODUCT_EXPIRED`, `SUBSCRIPTION_EXPIRING`, `TRIAL_ENDING`, `SUBSCRIPTION_ACTIVE`, `NEW_ORDER`, `PAYMENT_RECEIVED`, `PAYMENT_FAILED`, `EXPORT_READY`, `CLIENT_REGISTERED`, `CONSIGNMENT_ALERT` |
| `EstadoSuscripcion` | `PRUEBA`, `ACTIVO`, `ATRASADO`, `CANCELADO`, `INCOMPLETO`, `VENCIDO` |
| `ProveedorSuscripcion` | `MERCADOPAGO`, `PAYPAL`, `PROMO` |
