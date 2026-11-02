BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

SELECT pg_advisory_xact_lock(hashtextextended('t12_venta_numbering_authority', 0));

LOCK TABLE public."Consignacion" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public."Venta" IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public."Venta"
    WHERE "numeroVenta" IS NOT NULL
    GROUP BY "sucursalId", "numeroVenta"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'T12 numbering authority refused: duplicate Venta numbering';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public."Consignacion"
    GROUP BY "clienteId", "numeroFolio"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'T12 numbering authority refused: duplicate Consignacion numbering';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public."Venta"
    WHERE "sucursalId" IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM public."Consignacion"
    WHERE "clienteId" IS NULL OR "numeroFolio" IS NULL
  ) THEN
    RAISE EXCEPTION 'T12 numbering authority refused: unexpected null scope or folio';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public."Venta"
    WHERE "numeroVenta" = 2147483647
  ) OR EXISTS (
    SELECT 1
    FROM public."Consignacion"
    WHERE "numeroFolio" = 2147483647
  ) THEN
    RAISE EXCEPTION 'T12 numbering authority refused: integer numbering exhausted';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public."Venta"'::regclass
      AND attname = 'sucursalId'
      AND attnotnull
      AND NOT attisdropped
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public."Venta"'::regclass
      AND attname = 'numeroVenta'
      AND attnotnull
      AND NOT attisdropped
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public."Consignacion"'::regclass
      AND attname IN ('clienteId', 'numeroFolio')
      AND attnotnull
      AND NOT attisdropped
    GROUP BY attrelid
    HAVING COUNT(*) = 2
  ) THEN
    RAISE EXCEPTION 'T12 numbering authority refused: unexpected column nullability';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger
    WHERE tgrelid IN ('public."Venta"'::regclass, 'public."Consignacion"'::regclass)
      AND NOT tgisinternal
      AND (tgtype & 2) = 2
      AND ((tgtype & 4) = 4 OR (tgtype & 16) = 16)
  ) THEN
    RAISE EXCEPTION 'T12 numbering authority refused: conflicting BEFORE trigger';
  END IF;
END $$;

CREATE UNIQUE INDEX "Venta_sucursalId_numeroVenta_key_t12"
  ON public."Venta" ("sucursalId", "numeroVenta");

DROP INDEX public."Consignacion_clienteId_numeroFolio_idx";

CREATE UNIQUE INDEX "Consignacion_clienteId_numeroFolio_key_t12"
  ON public."Consignacion" ("clienteId", "numeroFolio");

CREATE TABLE public."VentaNumerador" (
  "sucursalId" INTEGER PRIMARY KEY,
  "ultimoNumero" INTEGER NOT NULL CHECK ("ultimoNumero" >= 0)
);

CREATE TABLE public."ConsignacionNumerador" (
  "clienteId" INTEGER PRIMARY KEY,
  "ultimoNumero" INTEGER NOT NULL CHECK ("ultimoNumero" >= 0)
);

INSERT INTO public."VentaNumerador" ("sucursalId", "ultimoNumero")
SELECT "sucursalId", MAX("numeroVenta")
FROM public."Venta"
WHERE "numeroVenta" IS NOT NULL
GROUP BY "sucursalId";

INSERT INTO public."ConsignacionNumerador" ("clienteId", "ultimoNumero")
SELECT "clienteId", MAX("numeroFolio")
FROM public."Consignacion"
GROUP BY "clienteId";

CREATE FUNCTION public.t12_assign_venta_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  allocated INTEGER;
BEGIN
  INSERT INTO public."VentaNumerador" AS counter ("sucursalId", "ultimoNumero")
  VALUES (NEW."sucursalId", 1)
  ON CONFLICT ("sucursalId") DO UPDATE
  SET "ultimoNumero" = counter."ultimoNumero" + 1
  RETURNING counter."ultimoNumero" INTO allocated;

  NEW."numeroVenta" := allocated;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.t12_assign_consignacion_folio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  allocated INTEGER;
BEGIN
  INSERT INTO public."ConsignacionNumerador" AS counter ("clienteId", "ultimoNumero")
  VALUES (NEW."clienteId", 1)
  ON CONFLICT ("clienteId") DO UPDATE
  SET "ultimoNumero" = counter."ultimoNumero" + 1
  RETURNING counter."ultimoNumero" INTO allocated;

  NEW."numeroFolio" := allocated;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.t12_guard_venta_numbering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF NEW."sucursalId" IS DISTINCT FROM OLD."sucursalId"
     OR NEW."numeroVenta" IS DISTINCT FROM OLD."numeroVenta" THEN
    RAISE EXCEPTION 'Venta numbering scope and value are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.t12_guard_consignacion_numbering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF NEW."clienteId" IS DISTINCT FROM OLD."clienteId"
     OR NEW."numeroFolio" IS DISTINCT FROM OLD."numeroFolio" THEN
    RAISE EXCEPTION 'Consignacion numbering scope and value are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "t12_assign_venta_numero"
BEFORE INSERT ON public."Venta"
FOR EACH ROW EXECUTE FUNCTION public.t12_assign_venta_numero();

CREATE TRIGGER "t12_assign_consignacion_folio"
BEFORE INSERT ON public."Consignacion"
FOR EACH ROW EXECUTE FUNCTION public.t12_assign_consignacion_folio();

CREATE TRIGGER "t12_guard_venta_numbering"
BEFORE UPDATE OF "sucursalId", "numeroVenta" ON public."Venta"
FOR EACH ROW EXECUTE FUNCTION public.t12_guard_venta_numbering();

CREATE TRIGGER "t12_guard_consignacion_numbering"
BEFORE UPDATE OF "clienteId", "numeroFolio" ON public."Consignacion"
FOR EACH ROW EXECUTE FUNCTION public.t12_guard_consignacion_numbering();

REVOKE ALL ON TABLE public."VentaNumerador" FROM PUBLIC;
REVOKE ALL ON TABLE public."ConsignacionNumerador" FROM PUBLIC;
REVOKE ALL ON FUNCTION public.t12_assign_venta_numero() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.t12_assign_consignacion_folio() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.t12_guard_venta_numbering() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.t12_guard_consignacion_numbering() FROM PUBLIC;

COMMIT;
