# API Referencia Tecnica

Esta referencia describe el contrato tecnico de la API HTTP (`src/app/api/**/route.ts`) para integraciones internas, frontend y mantenimiento.

## 1) Convenciones globales

### Base URL

- Desarrollo: `http://localhost:3000`
- Produccion: `NEXT_PUBLIC_APP_URL` o dominio publicado

### Formato de respuesta

- Exito (patron principal):

```json
{ "data": {} }
```

- Exito con metadatos adicionales (casos puntuales):

```json
{ "data": {}, "message": "..." }
```

- Error:

```json
{ "error": "mensaje" }
```

### Autenticacion

- Se usa cookie HttpOnly con JWT (`JWT_COOKIE_NAME`, por defecto `access_token`).
- Las rutas protegidas validan JWT + sesion activa en DB (`UserSession`) via `requireAuth()`.

### Contexto multisucursal

- Header opcional: `x-sucursal-id: <int>`.
- `ADMIN` puede cambiar sucursal activa.
- `EMPLEADO` queda restringido a su sucursal asignada.

### Errores comunes

- `400`: validacion de entrada o payload invalido.
- `401`: no autenticado, token invalido o sesion revocada.
- `403`: permisos insuficientes o limite del plan alcanzado.
- `404`: recurso no encontrado.
- `409`: conflicto de negocio (stock insuficiente, concurrencia).
- `500`: error interno.

## 2) Endpoints por dominio

## Autenticacion

| Metodo | Endpoint                    | Auth       | Body/Query principal  | Respuesta exito                                     | Errores habituales |
| :----- | :-------------------------- | :--------- | :-------------------- | :-------------------------------------------------- | :----------------- |
| POST   | `/api/auth/login`           | No         | `{ email, password }` | `{ data: { id, nombre, email, rol } }` + set-cookie | 400, 401           |
| POST   | `/api/auth/logout`          | Si         | -                     | `{ data: { ok: true } }`                            | 401                |
| GET    | `/api/auth/me`              | Si         | -                     | `{ data: usuario + contexto }`                      | 401                |
| POST   | `/api/auth/forgot-password` | No         | `{ email }`           | `{ message }`                                       | 400, 404           |
| POST   | `/api/auth/reset-password`  | No         | `{ token, password }` | `{ message }`                                       | 400, 410           |
| POST   | `/api/auth/setup-auth`      | No (setup) | datos iniciales admin | `{ data: usuarioInicial }`                          | 400, 409           |

## Dashboard

| Metodo | Endpoint                        | Auth | Query/Body principal | Respuesta exito     |
| :----- | :------------------------------ | :--- | :------------------- | :------------------ |
| GET    | `/api/dashboard/kpi`            | Si   | `period=week         | month               | year  | all`               | `{ data: kpis }` |
| GET    | `/api/dashboard/tendencia`      | Si   | `period=week         | month               | year` | `{ data: series }` |
| GET    | `/api/dashboard/top-productos`  | Si   | `period`, `limit`    | `{ data: top }`     |
| GET    | `/api/dashboard/consignaciones` | Si   | `limit`              | `{ data: resumen }` |
| POST   | `/api/dashboard/reporte-link`   | Si   | `period`, `type`     | `{ url }`           |

## Productos, categorias y subcategorias

| Metodo    | Endpoint                         | Auth       | Body/Query principal                   | Respuesta exito            | Errores       |
| :-------- | :------------------------------- | :--------- | :------------------------------------- | :------------------------- | :------------ |
| GET       | `/api/productos`                 | Si         | -                                      | `{ data: producto[] }`     | 401, 500      |
| POST      | `/api/productos`                 | Si (ADMIN) | `createProductoSchema`                 | `{ data: producto }` (201) | 400, 403, 500 |
| GET       | `/api/productos/[id]`            | Si         | -                                      | `{ data: producto }`       | 404           |
| PUT       | `/api/productos/[id]`            | Si (ADMIN) | campos editables                       | `{ data: producto }`       | 400, 404      |
| DELETE    | `/api/productos/[id]`            | Si (ADMIN) | -                                      | `{ data: { ok: true } }`   | 404, 409      |
| GET       | `/api/productos/barcode/[code]`  | Si         | -                                      | `{ data: producto }`       | 404           |
| POST      | `/api/productos/inventario-link` | Si         | `sucursalId?`                          | `{ url }`                  | 400           |
| GET       | `/api/categorias`                | Si         | -                                      | `{ data: categoria[] }`    | 401           |
| POST      | `/api/categorias`                | Si (ADMIN) | `{ nombre, color? }`                   | `{ data: categoria }`      | 400, 409      |
| PATCH/PUT | `/api/categorias/[id]`           | Si (ADMIN) | campos editables                       | `{ data: categoria }`      | 400, 404      |
| DELETE    | `/api/categorias/[id]`           | Si (ADMIN) | -                                      | `{ data: { ok: true } }`   | 404, 409      |
| GET       | `/api/subcategorias`             | Si         | `categoriaId`                          | `{ data: subcategoria[] }` | 400           |
| POST      | `/api/subcategorias`             | Si (ADMIN) | `{ nombre, categoriaId, descuentos? }` | `{ data: subcategoria }`   | 400, 409      |
| PATCH/PUT | `/api/subcategorias/[id]`        | Si (ADMIN) | campos editables                       | `{ data: subcategoria }`   | 400, 404      |
| DELETE    | `/api/subcategorias/[id]`        | Si (ADMIN) | -                                      | `{ data: { ok: true } }`   | 404, 409      |

## Ventas, pagos y clientes

| Metodo | Endpoint                           | Auth | Body/Query principal                                    | Respuesta exito               | Errores            |
| :----- | :--------------------------------- | :--- | :------------------------------------------------------ | :---------------------------- | :----------------- |
| GET    | `/api/ventas`                      | Si   | -                                                       | `{ data: venta[] }`           | 401                |
| POST   | `/api/ventas`                      | Si   | `{ clienteId?, items[], metodoPago, descuentoGlobal? }` | `{ data: venta, pago }`       | 400, 403, 409, 500 |
| GET    | `/api/ventas/[id]`                 | Si   | -                                                       | `{ data: venta }`             | 404                |
| PUT    | `/api/ventas/[id]`                 | Si   | ajustes de venta                                        | `{ data: venta }`             | 400, 404           |
| DELETE | `/api/ventas/[id]`                 | Si   | `{ motivo, brokenItems? }`                              | `{ data: { success: true } }` | 400, 404           |
| POST   | `/api/ventas/[id]/ticket-link`     | Si   | -                                                       | `{ url }`                     | 404                |
| GET    | `/api/clientes`                    | Si   | -                                                       | `{ data: cliente[] }`         | 401                |
| POST   | `/api/clientes`                    | Si   | datos cliente                                           | `{ data: cliente }`           | 400                |
| GET    | `/api/clientes/[id]`               | Si   | -                                                       | `{ data: cliente }`           | 404                |
| PUT    | `/api/clientes/[id]`               | Si   | campos editables                                        | `{ data: cliente }`           | 400, 404           |
| DELETE | `/api/clientes/[id]`               | Si   | -                                                       | `{ data: { ok/success } }`    | 404, 409           |
| GET    | `/api/clientes/[id]/estado-cuenta` | Si   | -                                                       | `{ data: estadoCuenta }`      | 404                |
| GET    | `/api/clientes/[id]/pagos`         | Si   | -                                                       | `{ data: pagos[] }`           | 404                |
| POST   | `/api/clientes/[id]/pagos`         | Si   | pago a cuenta                                           | `{ data: pago }`              | 400, 404           |
| GET    | `/api/pagos/[clienteId]`           | Si   | -                                                       | `{ data: pago[] }`            | 404                |
| POST   | `/api/pagos`                       | Si   | `{ clienteId, monto, metodo, ... }`                     | `{ data: pago }`              | 400, 404           |

## Consignaciones y liquidaciones

| Metodo | Endpoint                                           | Auth | Body/Query principal       | Respuesta exito                | Errores            |
| :----- | :------------------------------------------------- | :--- | :------------------------- | :----------------------------- | :----------------- |
| GET    | `/api/consignaciones`                              | Si   | -                          | `{ data: consignacion[] }`     | 401                |
| POST   | `/api/consignaciones`                              | Si   | `createConsignacionSchema` | `{ data: consignacion }` (201) | 400, 403, 404, 409 |
| GET    | `/api/consignaciones/[id]`                         | Si   | -                          | `{ data: consignacion }`       | 404                |
| PUT    | `/api/consignaciones/[id]`                         | Si   | edicion consignacion       | `{ data: consignacion }`       | 400, 404           |
| DELETE | `/api/consignaciones/[id]`                         | Si   | -                          | `{ data: { ok/success } }`     | 404, 409           |
| POST   | `/api/consignaciones/[id]/remito-link`             | Si   | -                          | `{ url }`                      | 404                |
| GET    | `/api/liquidaciones`                               | Si   | filtros opcionales         | `{ data: liquidacion[] }`      | 401                |
| POST   | `/api/liquidaciones`                               | Si   | datos liquidacion          | `{ data: liquidacion }`        | 400, 404           |
| GET    | `/api/liquidaciones/[id]`                          | Si   | -                          | `{ data: liquidacion }`        | 404                |
| PUT    | `/api/liquidaciones/[id]`                          | Si   | items/ajustes              | `{ data: liquidacion }`        | 400, 404           |
| GET    | `/api/liquidaciones/consignacion/[consignacionId]` | Si   | -                          | `{ data: liquidacion[] }`      | 404                |

## Caja y seguridad

| Metodo | Endpoint                            | Auth | Body/Query principal           | Respuesta exito           |
| :----- | :---------------------------------- | :--- | :----------------------------- | :------------------------ |
| GET    | `/api/settings/pos/cajas`           | Si   | -                              | `{ data: caja[] }`        |
| POST   | `/api/settings/pos/cajas`           | Si   | abrir caja / crear caja        | `{ data: ... }`           |
| GET    | `/api/settings/pos/cajas/turno`     | Si   | -                              | `{ data: sesionActiva     | null }` |
| PATCH  | `/api/settings/pos/cajas/turno`     | Si   | `{ minutos }`                  | `{ data: sesion }`        |
| POST   | `/api/settings/pos/cajas/cerrar`    | Si   | cierre de caja                 | `{ data: sesion }`        |
| GET    | `/api/settings/pos/cajas/historial` | Si   | -                              | `{ data: sesion[] }`      |
| GET    | `/api/security/sessions`            | Si   | -                              | `{ data: userSession[] }` |
| DELETE | `/api/security/sessions`            | Si   | `id` query                     | `{ data: { ok: true } }`  |
| GET    | `/api/security/activity`            | Si   | `module?`, `userId?`, `limit?` | `{ data: auditLog[] }`    |

## Settings y administracion

| Metodo     | Endpoint                             | Auth                    | Body/Query principal  | Respuesta exito                     |
| :--------- | :----------------------------------- | :---------------------- | :-------------------- | :---------------------------------- |
| GET/PUT    | `/api/settings/general`              | Si (PUT ADMIN)          | config operativa      | `{ data: configuracion, message? }` |
| GET/PUT    | `/api/settings/branding`             | Si (PUT ADMIN)          | branding y tienda     | `{ data: branding }`                |
| GET        | `/api/settings/branding/logo`        | Si                      | -                     | binario/logo                        |
| POST       | `/api/settings/branding/logo/upload` | Si                      | `multipart/form-data` | `{ data: logo/banner }`             |
| GET/POST   | `/api/settings/sucursales`           | Si (POST ADMIN)         | datos sucursal        | `{ data: sucursal[]/sucursal }`     |
| PUT/DELETE | `/api/settings/sucursales/[id]`      | Si (ADMIN)              | datos sucursal        | `{ data: sucursal                   | ok }` |
| GET/POST   | `/api/settings/users`                | Si (ADMIN)              | datos usuario         | `{ data: usuario[]/usuario }`       |
| GET/PUT    | `/api/settings/pos/horarios`         | Si (ADMIN para cambios) | horarios por usuario  | `{ data: horarios }`                |
| GET        | `/api/settings/plan-limits`          | Si                      | -                     | `{ data: limitesPlan }`             |

## Gastos

| Metodo         | Endpoint                            | Auth                        | Body/Query principal | Respuesta exito                   |
| :------------- | :---------------------------------- | :-------------------------- | :------------------- | :-------------------------------- |
| GET/POST       | `/api/gastos`                       | Si (POST ADMIN recomendado) | filtros / alta gasto | `{ data: gasto[]/gasto }`         |
| GET/PUT/DELETE | `/api/gastos/[id]`                  | Si                          | detalle/edicion/baja | `{ data: gasto                    | ok }` |
| POST           | `/api/gastos/[id]/comprobante-link` | Si                          | -                    | `{ url }`                         |
| GET/POST       | `/api/gastos/categorias`            | Si                          | categoria gasto      | `{ data: categoria[]/categoria }` |
| PUT/DELETE     | `/api/gastos/categorias/[id]`       | Si                          | categoria gasto      | `{ data: categoria                | ok }` |

## Historial de inventario, notificaciones y archivos

| Metodo     | Endpoint                             | Auth               | Body/Query principal     | Respuesta exito               |
| :--------- | :----------------------------------- | :----------------- | :----------------------- | :---------------------------- |
| GET        | `/api/historial`                     | Si                 | filtros por periodo/tipo | `{ data: movimiento[] }`      |
| GET        | `/api/historial/anios`               | Si                 | -                        | `{ data: number[] }`          |
| GET        | `/api/historial/[id]`                | Si                 | -                        | `{ data: movimiento }`        |
| POST       | `/api/historial/[id]/historial-link` | Si                 | `anio`/periodo           | `{ url }`                     |
| GET        | `/api/notificaciones`                | Si                 | `onlyUnread`, `limit`    | `{ data: notification[] }`    |
| POST       | `/api/notificaciones/create`         | Si                 | payload notificacion     | `{ data: notification }`      |
| PATCH/POST | `/api/notificaciones/[id]/read`      | Si                 | -                        | `{ data: { success: true } }` |
| PATCH/POST | `/api/notificaciones/read-all`       | Si                 | -                        | `{ data: { success: true } }` |
| DELETE     | `/api/notificaciones`                | Si                 | -                        | `{ data: { success: true } }` |
| POST       | `/api/upload`                        | Si                 | `multipart/form-data`    | `{ data: { url } }`           |
| GET        | `/api/files/[...path]`               | Publica controlada | ruta de archivo          | archivo/buffer                |

## Publico (sin login)

| Metodo | Endpoint                     | Auth | Body/Query principal        | Respuesta exito                |
| :----- | :--------------------------- | :--- | :-------------------------- | :----------------------------- |
| GET    | `/api/public/lista-precios`  | No   | `sucursalId?`               | `{ data: catalogo }`           |
| POST   | `/api/public/checkout`       | No   | carrito + comprador + envio | `{ data: preferenciaPago }`    |
| POST   | `/api/public/envios/cotizar` | No   | direccion/cp/subtotal       | `{ data: cotizacionAndreani }` |

## Setup inicial

| Metodo | Endpoint                            | Auth | Body/Query principal    | Respuesta exito           |
| :----- | :---------------------------------- | :--- | :---------------------- | :------------------------ |
| GET    | `/api/setup/status`                 | No   | -                       | `{ data: estadoSetup }`   |
| POST   | `/api/setup/initialize`             | No   | datos iniciales sistema | `{ data: resultadoInit }` |
| POST   | `/api/setup/create-preference`      | No   | payload plan/proveedor  | `{ data: preferencia }`   |
| POST   | `/api/setup/create-mp-subscription` | No   | datos comprador/plan    | `{ data: suscripcion }`   |
| POST   | `/api/setup/create-paypal`          | No   | datos comprador/plan    | `{ data: suscripcion }`   |
| POST   | `/api/setup/validate-promo`         | No   | `{ code }`              | `{ data: promoValida }`   |

## Webhooks y cron

| Metodo | Endpoint                               | Auth          | Body/Query principal | Respuesta exito                        |
| :----- | :------------------------------------- | :------------ | :------------------- | :------------------------------------- |
| POST   | `/api/webhooks/mercadopago`            | Firma webhook | evento MP            | `{ received: true }` / `{ data: ... }` |
| POST   | `/api/webhooks/paypal`                 | Firma webhook | evento PayPal        | `{ received: true }` / `{ data: ... }` |
| GET    | `/api/cron/check-vencimientos`         | `CRON_SECRET` | -                    | `{ data: resumenJob }`                 |
| GET    | `/api/cron/check-subscriptions`        | `CRON_SECRET` | -                    | `{ data: resumenJob }`                 |
| GET    | `/api/cron/consignaciones`             | `CRON_SECRET` | -                    | `{ data: resumenJob }`                 |
| GET    | `/api/cron/update-subscription-prices` | `CRON_SECRET` | -                    | `{ data: resumenJob }`                 |

## 3) Criterios de uso para integradores

- Reintentar `409` de operaciones de venta solo si el cliente puede reconstruir el carrito con stock actualizado.
- Nunca confiar en totales calculados del frontend; el backend recalcula y persiste.
- Para jobs cron, enviar secreto en header/query segun implementacion del endpoint.
- Para endpoints protegidos, no enviar JWT por header: la autenticacion oficial del sistema es por cookie HttpOnly.

## 4) Ejemplos JSON (endpoints criticos)

### 4.1 Login

`POST /api/auth/login`

Request:

```json
{
  "email": "admin@empresa.com",
  "password": "MiClaveSegura123!"
}
```

Response 200:

```json
{
  "data": {
    "id": 1,
    "nombre": "Admin",
    "email": "admin@empresa.com",
    "rol": "ADMIN"
  }
}
```

Response 401:

```json
{
  "error": "Credenciales invalidas"
}
```

### 4.2 Venta POS

`POST /api/ventas`

Request:

```json
{
  "clienteId": 45,
  "metodoPago": "EFECTIVO",
  "descuentoGlobal": 0,
  "items": [
    {
      "productoId": 120,
      "units": 2,
      "descuento": 0
    },
    {
      "productoId": 201,
      "units": 1,
      "descuento": 150
    }
  ]
}
```

Response 200:

```json
{
  "data": {
    "id": 983,
    "clienteId": 45,
    "tipo": "CASUAL",
    "metodoPago": "EFECTIVO",
    "total": 14350,
    "sucursalId": 1
  },
  "pago": {
    "id": 774,
    "clienteId": 45,
    "monto": 14350,
    "metodo": "EFECTIVO"
  }
}
```

Response 409:

```json
{
  "error": "Stock insuficiente para \"Yerba 1kg\"."
}
```

### 4.3 Consignacion

`POST /api/consignaciones`

Request:

```json
{
  "clienteId": 45,
  "items": [
    {
      "productoId": 120,
      "unitsEntregadas": 10,
      "descuento": 0
    },
    {
      "productoId": 201,
      "unitsEntregadas": 5,
      "descuento": 0
    }
  ]
}
```

Response 201:

```json
{
  "data": {
    "id": 301,
    "clienteId": 45,
    "numeroFolio": 12,
    "estado": "ABIERTA",
    "porcentajeAumento": 10,
    "sucursalId": 1
  }
}
```

Response 403:

```json
{
  "error": "Tu plan actual no habilita consignaciones",
  "limitReached": true
}
```

### 4.4 Checkout publico

`POST /api/public/checkout`

Request:

```json
{
  "sucursalId": 1,
  "items": [
    {
      "productoId": 120,
      "quantity": 2
    }
  ],
  "buyer": {
    "nombre": "Juan Perez",
    "email": "juan@mail.com",
    "telefono": "+5491112345678"
  },
  "shipping": {
    "metodo": "DOMICILIO",
    "codigoPostal": "1000",
    "direccion": "Av Siempre Viva 742"
  }
}
```

Response 200:

```json
{
  "data": {
    "provider": "MERCADOPAGO",
    "preferenceId": "1234567890-abcd-efgh",
    "initPoint": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=..."
  }
}
```

### 4.5 Webhook MercadoPago

`POST /api/webhooks/mercadopago`

Request (ejemplo simplificado):

```json
{
  "id": 123456789,
  "type": "payment",
  "action": "payment.created",
  "data": {
    "id": "987654321"
  }
}
```

Response 200 (variante comun):

```json
{
  "received": true
}
```

## 5) Ejemplos cURL (listo para QA/Postman)

> Ajusta `BASE_URL` y `COOKIE_FILE` segun tu entorno. Los endpoints autenticados usan cookie de sesion.

### 5.1 Login y guardar cookie

```bash
BASE_URL="http://localhost:3000"
COOKIE_FILE="./cookies.txt"

curl -i -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -c "$COOKIE_FILE" \
  --data-raw '{
    "email": "admin@empresa.com",
    "password": "MiClaveSegura123!"
  }'
```

### 5.2 Consultar usuario autenticado

```bash
curl -i -X GET "$BASE_URL/api/auth/me" \
  -b "$COOKIE_FILE"
```

### 5.3 Crear venta POS

```bash
curl -i -X POST "$BASE_URL/api/ventas" \
  -H "Content-Type: application/json" \
  -H "x-sucursal-id: 1" \
  -b "$COOKIE_FILE" \
  --data-raw '{
    "clienteId": 45,
    "metodoPago": "EFECTIVO",
    "descuentoGlobal": 0,
    "items": [
      { "productoId": 120, "units": 2, "descuento": 0 },
      { "productoId": 201, "units": 1, "descuento": 150 }
    ]
  }'
```

### 5.4 Crear consignacion

```bash
curl -i -X POST "$BASE_URL/api/consignaciones" \
  -H "Content-Type: application/json" \
  -H "x-sucursal-id: 1" \
  -b "$COOKIE_FILE" \
  --data-raw '{
    "clienteId": 45,
    "items": [
      { "productoId": 120, "unitsEntregadas": 10, "descuento": 0 },
      { "productoId": 201, "unitsEntregadas": 5, "descuento": 0 }
    ]
  }'
```

### 5.5 Checkout publico

```bash
curl -i -X POST "$BASE_URL/api/public/checkout" \
  -H "Content-Type: application/json" \
  --data-raw '{
    "sucursalId": 1,
    "items": [{ "productoId": 120, "quantity": 2 }],
    "buyer": {
      "nombre": "Juan Perez",
      "email": "juan@mail.com",
      "telefono": "+5491112345678"
    },
    "shipping": {
      "metodo": "DOMICILIO",
      "codigoPostal": "1000",
      "direccion": "Av Siempre Viva 742"
    }
  }'
```

### 5.6 Webhook MercadoPago (simulacion local)

```bash
curl -i -X POST "$BASE_URL/api/webhooks/mercadopago" \
  -H "Content-Type: application/json" \
  --data-raw '{
    "id": 123456789,
    "type": "payment",
    "action": "payment.created",
    "data": { "id": "987654321" }
  }'
```

## 6) Fuente de verdad

Si hay divergencia entre este documento y el comportamiento real, prevalece el codigo:

- `src/app/api/**/route.ts`
- `src/lib/requireAuth.ts`
- `src/lib/apiService.ts`

## 7) PowerShell (Windows)

Ejemplos equivalentes para equipos Windows usando `Invoke-RestMethod`.

```powershell
$BASE_URL = "http://localhost:3000"
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
```

### 7.1 Login y sesion

```powershell
$loginBody = @{
  email = "admin@empresa.com"
  password = "MiClaveSegura123!"
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "$BASE_URL/api/auth/login" `
  -WebSession $session `
  -ContentType "application/json" `
  -Body $loginBody
```

### 7.2 Usuario autenticado

```powershell
Invoke-RestMethod -Method Get -Uri "$BASE_URL/api/auth/me" -WebSession $session
```

### 7.3 Crear venta POS

```powershell
$ventaBody = @{
  clienteId = 45
  metodoPago = "EFECTIVO"
  descuentoGlobal = 0
  items = @(
    @{ productoId = 120; units = 2; descuento = 0 },
    @{ productoId = 201; units = 1; descuento = 150 }
  )
} | ConvertTo-Json -Depth 6

Invoke-RestMethod -Method Post -Uri "$BASE_URL/api/ventas" `
  -WebSession $session `
  -ContentType "application/json" `
  -Headers @{ "x-sucursal-id" = "1" } `
  -Body $ventaBody
```

### 7.4 Crear consignacion

```powershell
$consigBody = @{
  clienteId = 45
  items = @(
    @{ productoId = 120; unitsEntregadas = 10; descuento = 0 },
    @{ productoId = 201; unitsEntregadas = 5; descuento = 0 }
  )
} | ConvertTo-Json -Depth 6

Invoke-RestMethod -Method Post -Uri "$BASE_URL/api/consignaciones" `
  -WebSession $session `
  -ContentType "application/json" `
  -Headers @{ "x-sucursal-id" = "1" } `
  -Body $consigBody
```

### 7.5 Checkout publico

```powershell
$checkoutBody = @{
  sucursalId = 1
  items = @(@{ productoId = 120; quantity = 2 })
  buyer = @{
    nombre = "Juan Perez"
    email = "juan@mail.com"
    telefono = "+5491112345678"
  }
  shipping = @{
    metodo = "DOMICILIO"
    codigoPostal = "1000"
    direccion = "Av Siempre Viva 742"
  }
} | ConvertTo-Json -Depth 8

Invoke-RestMethod -Method Post -Uri "$BASE_URL/api/public/checkout" `
  -ContentType "application/json" `
  -Body $checkoutBody
```

### 7.6 Webhook MercadoPago (simulacion)

```powershell
$webhookBody = @{
  id = 123456789
  type = "payment"
  action = "payment.created"
  data = @{ id = "987654321" }
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "$BASE_URL/api/webhooks/mercadopago" `
  -ContentType "application/json" `
  -Body $webhookBody
```
