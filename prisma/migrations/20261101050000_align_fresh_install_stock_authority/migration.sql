-- Migration: align_fresh_install_stock_authority
--
-- `20260322000000_trigger_sync_producto_stock` installs the projection trigger
-- and `20261101030000_establish_stock_authority` seeds the capability row as
-- APP_DUAL_WRITE. On a fresh database that leaves the exact pair B1 forbids:
-- APP_DUAL_WRITE expects no projection, so `lockStockAuthority` rejects it and
-- every writer returns 503.
--
-- Production never hit it because T14-R left the trigger disabled and the T16
-- cutover reinstalled it together with DB_PROJECTION. This migration makes the
-- post-migration state coherent without touching a cut-over database: it only
-- removes the trigger while the capability is still APP_DUAL_WRITE. Under
-- DB_PROJECTION the trigger *is* the projection and must stay.
--
-- Additive and idempotent: no data changes, no function changes.

DO $$
DECLARE
  v_modo TEXT;
BEGIN
  SELECT "modo" INTO v_modo FROM public."StockAutoridad" WHERE "id" = 1;

  IF v_modo = 'APP_DUAL_WRITE' THEN
    EXECUTE 'DROP TRIGGER IF EXISTS "trg_sync_producto_stock" ON public."StockSucursal"';
  END IF;
END
$$;
