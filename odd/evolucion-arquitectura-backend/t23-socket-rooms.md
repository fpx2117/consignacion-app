# T23 — Sesión vigente y salas en Socket.IO

## El problema

- El handshake verificaba sólo la **firma** del JWT. Una sesión revocada o vencida
  seguía conectada hasta que expiraba el token.
- `io.emit("new-notification", ...)` emitía a **todos** los sockets. Un aviso de
  venta de la sucursal A llegaba a la B, con el monto y el nombre del cliente.
- El productor ya mandaba `branch` (sólo el nombre), pero el servidor lo ignoraba.

## La corrección

### Sesión vigente

`src/lib/auth/session-validity.ts` concentra la regla (sesión existente, activa y
no vencida sobre el hash del token). La usan el guard HTTP (`requireAuth`, dentro
de su `cache` por request) y el handshake de Socket.IO. Una sola definición de
"sesión vigente".

### Salas

En la conexión el socket se une sólo a lo autorizado:

| Sala | Cuándo |
|---|---|
| `install` | siempre (instalación única) |
| `user:{id}` | siempre |
| `branch:{id}` | la sucursal activa; en vista global, **todas** las que el rol tiene permitidas (un admin puede monitorear, un empleado no) |

La sucursal activa se resuelve con `resolveEffectiveSucursalContext`, la misma
función del guard HTTP: se valida la cookie `active_sucursal_id`contra las
sucursales permitidas, así que no se puede entrar a una sala ajena cambiando la
cookie.

### Destino mínimo

`resolveNotificationRoom` decide a qué sala va cada evento:

| Aviso | Sala |
|---|---|
| venta, stock, vencimiento, consignación | `branch:{sucursalId}` |
| suscripción, prueba por vencer | `user:{userId}` |
| aviso del programa sin sucursal ni usuario | `install` |

El endpoint de dispatch emite con `io.to(room).emit(...)` y devuelve la sala usada
en la respuesta, así una omisión se ve en el log y en el contrato.

## Un gotcha del servidor custom

`server.ts` **no puede** importar `src/lib/auth/core.ts`: ese módulo importa
`next/headers`, y al cargarlo antes de que Next prepare su runtime el proceso
muere con `Invariant: AsyncLocalStorage accessed in runtime where it is not
available`. El servidor verifica la firma con `jose` y usa la regla compartida de
sesión. Queda documentado para que nadie lo "simplifique" de nuevo.

## Evidencia

- **Unitarias**: 11 de salas (incluye vista global, deduplicación, ids inválidos) y
  6 de validez de sesión (activa, revocada, vencida, inexistente; y que al lookup
  llegue el hash, nunca el token).
- **Cliente real de Socket.IO**: token sin sesión → `connect_error "Sesión no
  vigente"`; sesión activa → `connect`; revocada → error; vencida → error.
- **Aislamiento con dos clientes reales** en sucursales distintas: un aviso de la
  sucursal A llega sólo a A (`1/0`); uno personal a B sólo a B (`1/1`); uno de
  instalación a ambos (`2/2`).
- **Producción**: deploy `63604a35` SUCCESS, `/login` 200 y un cliente real
  conectado como `install, user:1, branch:1`. Sin errores de arranque.
- `tsc`, `lint`, `security:test` (25) y `next build` limpios; todas las suites
  unitarias verdes.

## Outbox

El ADR 005 lo deja como "si es necesaria". Hoy los efectos ya son **post-commit**
y best-effort: la notificación se persiste y el socket se emite después de
confirmar la transacción; un fallo del dispatch no revierte nada. No se agregó
outbox: sería infraestructura nueva para garantizar entrega, no para aislar. Queda
como decisión aparte si el negocio necesita entrega garantizada.

## Rollback

Sólo código. Revertir el deploy vuelve al broadcast global y a la validación por
firma; no hay esquema ni datos.
