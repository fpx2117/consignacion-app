# T15-A — Puente B1 y writer de creación de ventas

## Objetivo

Introducir el puente `B1` que obedece la capacidad persistida de stock y migrar
el writer de creación de ventas POS. Los demás writers permanecen en `L0` hasta
sus propias etapas.

## Contrato

- `lockStockAuthority` lee `StockAutoridad.id = 1` con `FOR SHARE` dentro de la
  transacción del writer y verifica el estado del trigger.
- `APP_DUAL_WRITE` exige trigger ausente; `DB_PROJECTION` exige trigger activo.
  Cualquier otra combinación lanza `StockAuthorityError` y el writer falla cerrado
  antes de mutar venta, pago, movimiento o stock.
- `APP_DUAL_WRITE`: `Producto` se actualiza con **delta atómico**, nunca
  recalculando `SUM(StockSucursal)`. Recomputar dentro de transacciones
  concurrentes de distintas sucursales pierde actualizaciones.
- `DB_PROJECTION`: sólo se escribe `StockSucursal`; `Producto` se lee después de
  que la proyección lo actualice.
- La venta POS conserva status, body, numeración, pagos, movimientos y alertas.
- El rechazo por autoridad responde `503` con
  `Autoridad de stock no disponible.` sin exponer detalles internos.
- El gate ocurre antes de mutar venta, pago, movimiento o stock. La creación del
  cliente por defecto sigue ocurriendo antes de la transacción y permanece en
  T20; T15-A no la mueve.

## Privilegios de runtime

PostgreSQL exige privilegio `UPDATE` sobre una tabla para adquirir cualquier
row-lock, incluido `SELECT ... FOR SHARE` (verificado en PostgreSQL 16). El rol
de runtime necesita `SELECT, UPDATE` sobre `StockAutoridad`; la aplicación nunca
modifica esa fila. Este grant debe incorporarse al rollout de roles de T12 antes
de desplegar `B1`.

## Pruebas obligatorias

- PostgreSQL 16 desde cero con las 32 migraciones.
- Matriz completa: `APP_DUAL_WRITE`/`DB_PROJECTION` × trigger presente/ausente;
  las dos combinaciones incompatibles fallan cerradas y la fila ausente también.
- POS bajo `APP_DUAL_WRITE` sin trigger: descuenta `StockSucursal` y `Producto`
  una sola vez y conserva el contrato existente.
- POS bajo `DB_PROJECTION` con trigger: descuenta `StockSucursal`, la proyección
  actualiza `Producto` y el writer no lo duplica.
- POS en estado incompatible: `503` y cero cambios en ventas, pagos, movimientos
  y ambas representaciones de stock.
- Dos writers `B1` concurrentes sobre sucursales distintas del mismo producto:
  `Producto` final igual a `SUM(StockSucursal)` sin updates perdidos.
- Prueba unitaria que fija la forma `increment` y prohíbe `aggregate`/`findMany`
  en `APP_DUAL_WRITE`, y que `DB_PROJECTION` nunca actualiza `Producto`.
- T12 y T13 permanecen verdes.

## Fuera de alcance

- Migrar anulación, consignaciones, liquidaciones, productos, OCR, pedidos
  esperados, checkout ni `sync-stock` (etapas T15 posteriores).
- Corregir la concurrencia del trigger de proyección (T16).
- Cutover, fence operativo, producción, commit, push o deploy.

## Detenerse si

- El writer necesita recalcular `SUM` para preservar su contrato.
- La capacidad no puede bloquearse antes de la primera mutación de stock.
- Cambia el contrato HTTP exitoso o la numeración PostgreSQL.
