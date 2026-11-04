# T24 — Webhooks y OCR idempotentes

## Webhooks

Mercado Pago y PayPal reintentan la entrega hasta recibir 2xx y pueden entregar
el mismo evento más de una vez. El checkout de MP ya tenía su propia idempotencia
(`pg_advisory_xact_lock` por `externalReference` + estado `PAID`), pero el resto
de los caminos no.

Se agregó la tabla `WebhookEvent` con `@@unique([provider, eventId])` y un
reclamo antes de procesar:

1. **Reclamar** (`INSERT`): si el evento ya existe, el handler devuelve
   `200 {received: true, duplicate: true}` sin efectos.
2. **Procesar**.
3. **Liberar** el reclamo si el procesamiento falla, para que el reintento del
   proveedor no quede bloqueado por un fallo transitorio.

Claves: `data.id` del evento para Mercado Pago (el mismo que firma), `event.id`
para PayPal. Si el proveedor no manda id, se procesa sin registro (no se inventa
una clave).

El checkout de MP conserva su lock y su chequeo de `PAID` como segunda capa: la
tabla cubre el evento, el intent cubre la venta.

## OCR

Confirmar un ítem, confirmarlo en masa, ignorarlo o crearle un producto leían su
estado y después lo actualizaban. Dos requests concurrentes pasaban las dos y
aplicaban stock dos veces (o creaban dos productos).

`claimItemState` convierte el cambio de estado en un `UPDATE ... WHERE estado NOT
IN (terminal)`, dentro de la misma transacción que mueve el stock. El perdedor
obtiene `count = 0`, revierte todo su trabajo y responde `409`. El chequeo previo
de `cargarItemFacturaAccesible` queda como respuesta amable; la garantía es el
reclamo.

Rutas: `items/[id]/confirm`, `[id]/confirm-all`, `items/[id]/ignore` y
`items/[id]/create-product` (que ahora reclama **antes** de crear el producto).

## Evidencia

- Unitarias del reclamo de webhooks: evento nuevo, duplicado por `P2002`, error
  distinto que no se confunde con duplicado y liberación.
- **PostgreSQL**: dos confirmaciones concurrentes del mismo ítem reclaman
  exactamente una vez (`[true, false]`), el estado queda `CONFIRMADO` y un tercer
  intento tampoco lo reclama.
- Batería completa de integración verde desde una base nueva (16 suites), incluida
  la de aplicación de stock de OCR.
- `tsc`, `lint`, `security:test` (25) y `next build` limpios.
- **Producción**: deploys `34c705df` y `4caecb7e` SUCCESS, `/login` 200,
  migración `20261101070000` aplicada (**36 migraciones**), `DB_PROJECTION`,
  trigger 1, **deriva 0**, tabla `WebhookEvent` presente y vacía, 922 ventas.

## Lo que queda fuera

- `process`/`upload` de la factura: reejecutar el OCR se apoya en los estados
  `PROCESABLES` de la factura; no se agregó un registro de extracciones. Es
  costoso (llamada al modelo) pero no aplica stock ni dinero.
- Retención de `WebhookEvent`: no hay purga. La tabla es chica (un registro por
  evento) pero conviene un cron cuando el volumen lo justifique.

## Rollback

La tabla es aditiva y no participa de ninguna lectura de negocio: revertir el
código la deja sin uso. El reclamo de ítems es código puro; revertir el deploy
vuelve al chequeo previo.
