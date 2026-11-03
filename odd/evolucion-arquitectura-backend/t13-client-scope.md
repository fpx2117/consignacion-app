# T13-A — Scoping de cliente en venta POS

## Objetivo

Impedir que `POST /api/ventas` asocie una venta o un pago a un cliente que no
pertenece a la sucursal activa.

## Contrato

- Todo `finalClienteId`, incluido el cliente por defecto, se valida dentro de
  cada intento de la transacción `Serializable`.
- La consulta exige simultáneamente `id` y `sucursalId`; un ID inexistente y un
  cliente de otra sucursal producen la misma respuesta para no filtrar su
  existencia.
- El rechazo devuelve `409` con
  `El cliente seleccionado no pertenece a la sucursal activa.`
- La validación ocurre antes de cualquier mutación de stock, venta, pago o
  movimiento.
- Se preservan el body exitoso, numeración PostgreSQL, retries, cálculos y
  comportamiento del cliente por defecto.

## Prueba obligatoria

La integración PostgreSQL invoca el handler con un cliente de otra sucursal y
demuestra respuesta `409` y ausencia de cambios en ventas, pagos, movimientos y
stock. El flujo válido existente debe permanecer verde.

## Fuera de alcance

- Anulación atómica (T13-B).
- Mover la creación de `Consumidor Final` o la sesión de caja dentro del retry
  (T20).
- Cambios de schema, migraciones, stock o contratos de otros endpoints.
- Producción, Railway, backfill, commit, push o deploy.

## Detenerse si

- La corrección exige cambiar el contrato exitoso de venta.
- Aparece una mutación previa a la validación dentro de la transacción.
- Se requiere tocar trabajo preexistente ajeno.
