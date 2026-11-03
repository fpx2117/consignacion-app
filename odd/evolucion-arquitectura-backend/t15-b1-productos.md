# T15-F — Productos sobre B1

## Objetivo

Migrar creación (`POST /api/productos`) y ajuste absoluto de stock
(`PUT /api/productos/[id]`) al puente `B1`.

## Contrato

- `lockStockAuthority` se ejecuta al inicio de ambas transacciones, antes de
  crear o leer stock.
- Creación: el producto nace con su stock inicial en `Producto` y
  `StockSucursal`; en `DB_PROJECTION` el trigger confirma la misma proyección.
- Ajuste: se actualiza primero `StockSucursal` y se aplica a `Producto` sólo el
  **delta** entre el stock nuevo y el previo de la sucursal.
- `APP_DUAL_WRITE` aplica el delta atómicamente; `DB_PROJECTION` no escribe
  `Producto` y deja que la proyección lo haga.
- Se excluye `stockDisponibleUnits` del update directo de `Producto` para evitar
  doble aplicación.
- El ajuste bloquea la fila de `StockSucursal` con `FOR UPDATE` y serializa por
  producto/sucursal, de modo que dos ajustes concurrentes calculan el delta desde
  el valor confirmado. El orden es `capacidad -> StockSucursal -> Producto`.
- Se asume el baseline reconciliado por T14. La reparación de un `Producto` ya
  drifted y sin fila local sigue siendo responsabilidad de T14; B1 no recomputa
  `SUM` para no perder actualizaciones concurrentes.
- Se preservan movimientos y `stockPrevio`/`stockPosterior`, respuesta, alertas y
  `revalidateTag`.
- Estado de autoridad incompatible, ausente o desconocido devuelve `503` con
  `Autoridad de stock no disponible.` sin crear ni mutar.

## Pruebas obligatorias

- Creación `APP_DUAL_WRITE` y `DB_PROJECTION`: stock local y global correctos,
  movimiento inicial.
- Ajuste `APP_DUAL_WRITE`: 5 → 8 aplica +3 al global y registra el movimiento.
- Ajuste `DB_PROJECTION`: 8 → 6 proyecta una sola vez y registra el movimiento.
- `503` en creación y ajuste incompatibles, sin cambios.
- Dos ajustes absolutos concurrentes sobre la misma fila producen un solo
  movimiento y un `Producto` final igual al stock local.
- Producto sin fila local con baseline 0: crea la fila y aplica el delta completo.
- Seams unitarios: el gate precede a `producto.create` y a la lectura de stock.

## Fuera de alcance

- Creación de producto desde factura/OCR (T15-G).
- Pedidos, checkout y `sync-stock`.
- Actualizaciones condicionales (T21), T16, producción.
