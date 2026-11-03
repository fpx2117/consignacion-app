# T15-D — Edición y liquidación de consignación sobre B1

## Objetivo

Migrar `PUT /api/consignaciones/[id]` (ajuste y eliminación de productos) y
`POST /api/consignaciones/[id]` (liquidación) al puente `B1`.

## Contrato

- `lockStockAuthority` es la primera operación de ambas transacciones, antes de
  leer la consignación o mover stock.
- Ajuste de entregadas: aplica el delta (positivo o negativo) a disponible y al
  opuesto a consignado en `StockSucursal`.
- Eliminación de producto: restituye disponible e incrementa/decrementa
  consignado por las unidades entregadas originales.
- Liquidación: resta `vendidas + devueltas` del consignado y suma `devueltas` al
  disponible.
- En `APP_DUAL_WRITE` los mismos deltas se aplican atómicamente a `Producto`.
- En `DB_PROJECTION` sólo se escribe `StockSucursal`; la proyección actualiza
  `Producto` una vez.
- Se preservan movimientos y sus `stockPrevio`/`stockPosterior`, alertas,
  respuestas `200`/`201`, creación de la venta de liquidación y cierre.
- Estado de autoridad incompatible, ausente o desconocido devuelve `503` con
  `Autoridad de stock no disponible.` antes de leer o mutar la consignación.

## Pruebas obligatorias

- Ajuste hacia arriba bajo `APP_DUAL_WRITE`: ambas representaciones y movimiento.
- Eliminación de producto: restitución local y global, detalle eliminado.
- Liquidación bajo `DB_PROJECTION`: consignado baja 3, disponible sube 1,
  `Producto` se proyecta una vez y se crea la venta.
- `503` en edición y liquidación incompatibles, sin cambios ni efectos.
- Prueba unitaria: el gate precede a `consignacion.findFirst`.

## Fuera de alcance

- Rutas de `/api/liquidaciones`, productos, OCR, pedidos, checkout y
  `sync-stock`.
- Actualizaciones condicionales y locks de lectura (T21).
- Concurrencia del trigger (T16), producción, commit, push o deploy.
