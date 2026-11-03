# T15-H — Pedidos esperados y checkout sobre B1

## Objetivo

Migrar la confirmación de pedidos esperados y el decremento de stock del webhook
de Mercado Pago al puente `B1`.

## Contrato

- `incrementBranchStock` hace upsert atómico con `increment` y aplica el mismo
  delta a `Producto`; `decrementBranchStock` hace decremento condicional
  (`stockDisponibleUnits >= units`) y aplica el delta negativo.
- Ambos helpers reciben la autoridad ya bloqueada por el caller.
- `DB_PROJECTION` no escribe `Producto`; el trigger proyecta.
- Confirmación de pedido: gate al inicio de la transacción, incremento por ítem,
  movimiento con `stockPrevio`/`stockPosterior` derivados del post-image.
- Webhook Mercado Pago: gate al inicio de la transacción, decremento condicional,
  movimiento con valores derivados, y `503` reintentable si la autoridad no es
  válida.
- Se preservan idempotencia, numeración, venta, pagos, estados y respuestas.
- `createVentaWithAuthority` y la numeración T12 no cambian.

## Nota sobre el guard de Producto

El webhook ya no exige `Producto.stockDisponibleUnits >= units`: bajo
`DB_PROJECTION` ese delta ya lo aplicó el trigger y un segundo control/ajuste
duplicaría. La consistencia de `Producto` es responsabilidad del baseline T14;
si hay deriva previa, se corrige en T14, no en el writer.

La lectura del pedido/estado fuera de la transacción y la doble confirmación
concurrente de un pedido son comportamiento preexistente y quedan fuera de
T15-H.

## Pruebas obligatorias

- Transiciones en `APP_DUAL_WRITE`: 5 +2 = 7; 7 −3 = 4 en ambas representaciones.
- Decremento insuficiente devuelve `null` y no muta nada.
- Transiciones en `DB_PROJECTION`: 4 +2 = 6; 6 −1 = 5 con proyección única.
- Incrementos y decrementos concurrentes aplican exactamente una vez cada uno.
- Wiring: el gate precede a `incrementBranchStock`/`decrementBranchStock` y ambos
  rutas mapean `503` sanitizado.

## Fuera de alcance

- `sync-stock`, productos/OCR ya migrados, T16, producción, commit/push/deploy.
