-- Migration: trigger_sync_producto_stock
-- Crea un trigger en StockSucursal que mantiene Producto.stockDisponibleUnits
-- y Producto.stockConsignadoUnits siempre sincronizados con la suma real
-- de todas las sucursales. Elimina la necesidad de dual-write manual.

CREATE OR REPLACE FUNCTION sync_producto_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_producto_id INT;
BEGIN
  -- Determinar el productoId afectado (INSERT/UPDATE usan NEW, DELETE usa OLD)
  IF TG_OP = 'DELETE' THEN
    v_producto_id := OLD."productoId";
  ELSE
    v_producto_id := NEW."productoId";
  END IF;

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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger anterior si existe (idempotente)
DROP TRIGGER IF EXISTS trg_sync_producto_stock ON "StockSucursal";

CREATE TRIGGER trg_sync_producto_stock
AFTER INSERT OR UPDATE OR DELETE ON "StockSucursal"
FOR EACH ROW
EXECUTE FUNCTION sync_producto_stock();
