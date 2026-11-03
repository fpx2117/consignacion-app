# T15-B — Anulación de ventas sobre B1

## Objetivo

Migrar la anulación de ventas al puente `B1` sin perder la atomicidad del claim
`anulada=false -> true` ni el comportamiento de roturas.

## Contrato

- `lockStockAuthority` se ejecuta al inicio de la transacción, antes del claim.
- `APP_DUAL_WRITE` suma la restitución a `StockSucursal` y aplica el mismo delta
  atómico a `Producto`.
- `DB_PROJECTION` sólo escribe `StockSucursal`; la proyección actualiza
  `Producto` una sola vez.
- Un detalle marcado como rotura no restituye stock ni modifica `Producto`; sólo
  marca `VentaDetalle.esRotura` y registra el movimiento `ROTURA`.
- Sólo la solicitud que gana el claim restituye. La perdedora conserva `400`.
- Venta ausente o ajena conserva `404`; ID inválido conserva `400`.
- Estado de autoridad incompatible, ausente o desconocido devuelve `503` con
  `Autoridad de stock no disponible.` y no reclama la venta ni muta stock.
- Cualquier fallo posterior revierte claim, detalles, movimientos, `StockSucursal`
  y `Producto`.

## Pruebas obligatorias

- Anulación concurrente sobre PostgreSQL 16: `[200, 400]`, una restitución y
  `Producto` incrementado exactamente una vez en `APP_DUAL_WRITE`.
- Rollback forzado tras una restitución normal y una rotura: todo el estado
  vuelve al snapshot, incluido `Producto` y `VentaDetalle.esRotura`.
- Estado incompatible: `503`, venta no anulada, sin movimientos ni cambios de
  stock.
- Varios detalles del mismo producto acumulan el delta exactamente una vez.
- `DB_PROJECTION`: restitución en `StockSucursal` y proyección única en
  `Producto`.
- Prueba unitaria del seam: el 503 ocurre antes de `venta.updateMany`.

## Fuera de alcance

- Consignaciones, liquidaciones, productos, OCR, pedidos, checkout y
  `sync-stock` (etapas T15 posteriores).
- Concurrencia del trigger bajo `DB_PROJECTION` (T16).
- Fence operativo, producción, commit, push o deploy.
