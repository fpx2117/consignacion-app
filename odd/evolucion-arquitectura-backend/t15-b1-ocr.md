# T15-G — OCR/facturas sobre B1

## Objetivo

Migrar la aplicación de stock al confirmar ítems de factura de proveedor y la
creación de producto desde factura al puente `B1`.

## Contrato

- `aplicarMovimientoStock` bloquea la capacidad, incrementa `StockSucursal` de
  forma atómica y aplica a `Producto` sólo el delta de la cantidad.
- En `DB_PROJECTION` no escribe `Producto`; el trigger proyecta el incremento.
- `create-product` bloquea la capacidad al inicio de su transacción, antes de
  crear el producto y su stock.
- `confirm`, `confirm-all` y `create-product` devuelven `503` sanitizado ante una
  autoridad incompatible, sin mutar stock.
- Se preservan movimientos (`stockPrevio`/`stockPosterior`), costos, alias,
  historial, estados de ítem/factura y purga del archivo.
- La confirmación masiva corta con `503` si la autoridad no es válida.

## Pruebas obligatorias

- `aplicarMovimientoStock` en `APP_DUAL_WRITE`: 5 + 2 deja 7 en ambas
  representaciones y movimiento 5→7.
- En `DB_PROJECTION`: 7 + 2 deja 9 en ambas, con una sola proyección.
- Dos aplicaciones concurrentes incrementan exactamente una vez cada una.
- Estado incompatible: error de autoridad y cero cambios.
- `create-product`: el gate precede a `producto.create` y mapea `503`.

## Fuera de alcance

- Pedidos esperados, checkout y `sync-stock`.
- Cambios de costos/alias o del pipeline OCR.
- T16, producción, commit, push o deploy.
