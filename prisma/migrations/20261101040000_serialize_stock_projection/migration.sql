-- Migration: serialize_stock_projection
--
-- The historical projection recomputed Producto = SUM(StockSucursal) inside each
-- transaction. Under READ COMMITTED, that SELECT does not block on uncommitted
-- rows: it reads the last committed version, so two concurrent writers on
-- different branches of the same product can each compute a sum that misses the
-- other's work and the last writer overwrites the projection (lost update).
--
-- The fix keeps the SUM (idempotent for creation paths that already write the
-- initial stock to both representations) and serializes the projection per
-- product by taking the Producto row lock before recomputing. The second
-- transaction waits for the first to commit and its SUM then starts from a fresh
-- snapshot that includes the committed branch change.
--
-- Additive: it only replaces the function body. It does not touch the trigger,
-- the capability row or any data. Installing the trigger stays a cutover step.

CREATE OR REPLACE FUNCTION sync_producto_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_producto_id INT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_producto_id := OLD."productoId";
  ELSE
    v_producto_id := NEW."productoId";
  END IF;

  -- Serialize projections for the same product. This is the whole fix: the lock
  -- turns the recompute into a critical section per Producto row.
  PERFORM 1 FROM "Producto" WHERE "id" = v_producto_id FOR UPDATE;

  UPDATE "Producto"
  SET
    "stockDisponibleUnits" = (
      SELECT COALESCE(SUM("stockDisponibleUnits"), 0)
      FROM "StockSucursal"
      WHERE "productoId" = v_producto_id
    ),
    "stockConsignadoUnits" = (
      SELECT COALESCE(SUM("stockConsignadoUnits"), 0)
      FROM "StockSucursal"
      WHERE "productoId" = v_producto_id
    )
  WHERE "id" = v_producto_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
