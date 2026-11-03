# T15-E — Rutas de liquidaciones sobre B1

## Objetivo

Migrar `PUT /api/liquidaciones/[id]` (corrección: reverso + nueva aplicación) y
`POST /api/liquidaciones/consignacion/[consignacionId]` (nueva liquidación) al
puente `B1`.

## Contrato

- `lockStockAuthority` es la primera operación de ambas transacciones, antes de
  leer la liquidación/consignación o mover stock.
- Corrección: primero revierte los ítems anteriores y luego aplica los nuevos,
  con los mismos deltas que el flujo legacy.
- Nueva liquidación: resta `vendidas + devueltas` del consignado y suma
  `devueltas` al disponible.
- En ambos flujos se actualiza primero `StockSucursal` y después se aplica el
  delta global con `applyProductoGlobalDelta`.
- `APP_DUAL_WRITE` aplica el delta atómicamente a `Producto`; `DB_PROJECTION`
  sólo escribe `StockSucursal` y lee el valor proyectado.
- Se preservan movimientos y sus `stockPrevio`/`stockPosterior`, borrado y
  recreación de la venta, saldo del cliente, cierre y respuestas `200`/`201`.
- Estado incompatible, ausente o desconocido devuelve `503` con
  `Autoridad de stock no disponible.` antes de leer o mutar.

## Pruebas obligatorias

- Corrección bajo `APP_DUAL_WRITE`: reverso de (2,1) y aplicación de (1,1)
  termina en disponible 11 / consignado 8 en ambas representaciones, 4
  movimientos, venta 100 y saldo 100.
- Corrección bajo `DB_PROJECTION`: (1,1) → (1,0) termina en disponible 10 /
  consignado 9, sin doble aplicación.
- Nueva liquidación bajo `DB_PROJECTION`: (2,1) termina en disponible 11 /
  consignado 2, una venta y dos movimientos.
- `503` en corrección y nueva liquidación incompatibles, sin cambios.
- Pruebas unitarias: el gate precede a `liquidacion.findFirst` y
  `consignacion.findFirst`.

## Fuera de alcance

- Productos, OCR, pedidos, checkout y `sync-stock`.
- Actualizaciones condicionales y locks de lectura (T21).
- Concurrencia del trigger (T16), producción, commit, push o deploy.
