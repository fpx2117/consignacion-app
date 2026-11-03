# T15-C — Entrega de consignación sobre B1

## Objetivo

Migrar la creación de consignaciones (`POST /api/consignaciones`) al puente
`B1`. Edición y liquidación de consignación quedan para T15-D.

## Contrato

- `lockStockAuthority` se ejecuta al inicio de la transacción, antes de crear la
  consignación o mover stock.
- `APP_DUAL_WRITE`: mueve `StockSucursal` de disponible a consignado y aplica el
  mismo delta atómico a `Producto`.
- `DB_PROJECTION`: sólo mueve `StockSucursal`; la proyección actualiza
  `Producto` una sola vez.
- Se preservan folio PostgreSQL, validaciones, movimientos, alertas y respuesta
  `201`.
- Estado de autoridad incompatible, ausente o desconocido devuelve `503` con
  `Autoridad de stock no disponible.` sin crear consignación ni mover stock.
- No se cambia la validación de stock previa ni se introduce la actualización
  condicional; eso pertenece a T21.

## Pruebas obligatorias

- `APP_DUAL_WRITE`: entrega de 2 unidades deja disponible 3, consignado 2 en
  ambas representaciones y un movimiento con `stockPrevio=5`,
  `stockPosterior=3`.
- `DB_PROJECTION`: entrega de 1 unidad deja disponible 2, consignado 3 en ambas
  representaciones; sin doble aplicación.
- Estado incompatible: `503`, sin consignación, movimiento ni cambio de stock.
- Prueba unitaria del seam: el 503 ocurre antes de `consignacion.create`.
- El test T12 de folio permanece verde en un estado compatible.

## Fuera de alcance

- Edición y liquidación de consignación (T15-D), rutas de liquidaciones.
- Actualización condicional de stock y locks de lectura (T21).
- Productos, OCR, pedidos, checkout, `sync-stock`, T16 y producción.
