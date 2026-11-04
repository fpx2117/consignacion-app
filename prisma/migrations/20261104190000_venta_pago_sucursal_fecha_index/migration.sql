-- M13: índices compuestos para la consulta caliente del dashboard.
--
-- La consulta es `where sucursalId + fecha + anulada` sobre Venta y Pago
-- (src/lib/dashboard/kpi-logic.ts:499-514). El schema sólo tenía índices
-- separados por sucursal y por (clienteId, fecha), así que el planner usaba el
-- índice de fecha y descartaba por filtro las filas de otras sucursales.
--
-- Medido con EXPLAIN (ANALYZE, BUFFERS) sobre un dump restaurado de producción:
--   Venta, sucursal + un mes: 20 buffers -> 10, filas descartadas 51 -> 1
--   Pago,  sucursal + un mes: 19 buffers ->  9, filas descartadas 50 -> 0
-- La vista global y el período "all" siguen usando Seq Scan, que es la decisión
-- correcta a ese volumen.
--
-- Migración aditiva: no modifica datos ni columnas.

CREATE INDEX IF NOT EXISTS "Venta_sucursalId_fecha_idx"
  ON "Venta" ("sucursalId", "fecha");

CREATE INDEX IF NOT EXISTS "Pago_sucursalId_fecha_idx"
  ON "Pago" ("sucursalId", "fecha");
