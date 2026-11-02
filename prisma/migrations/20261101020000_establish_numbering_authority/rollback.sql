BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

SELECT pg_advisory_xact_lock(hashtextextended('t12_venta_numbering_authority', 0));

LOCK TABLE public."Consignacion" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public."Venta" IN SHARE ROW EXCLUSIVE MODE;

DROP TRIGGER IF EXISTS "t12_guard_consignacion_numbering" ON public."Consignacion";
DROP TRIGGER IF EXISTS "t12_guard_venta_numbering" ON public."Venta";
DROP TRIGGER IF EXISTS "t12_assign_consignacion_folio" ON public."Consignacion";
DROP TRIGGER IF EXISTS "t12_assign_venta_numero" ON public."Venta";

DROP FUNCTION IF EXISTS public.t12_guard_consignacion_numbering();
DROP FUNCTION IF EXISTS public.t12_guard_venta_numbering();
DROP FUNCTION IF EXISTS public.t12_assign_consignacion_folio();
DROP FUNCTION IF EXISTS public.t12_assign_venta_numero();

DROP TABLE IF EXISTS public."ConsignacionNumerador";
DROP TABLE IF EXISTS public."VentaNumerador";

DROP INDEX IF EXISTS public."Consignacion_clienteId_numeroFolio_key_t12";
DROP INDEX IF EXISTS public."Venta_sucursalId_numeroVenta_key_t12";

CREATE INDEX "Consignacion_clienteId_numeroFolio_idx"
  ON public."Consignacion" ("clienteId", "numeroFolio");

COMMIT;
