BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

SELECT pg_advisory_xact_lock(hashtextextended('t14_stock_authority', 0));

CREATE TABLE public."StockAutoridad" (
  "id" INTEGER PRIMARY KEY,
  "modo" TEXT NOT NULL,
  "actualizadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockAutoridad_single_row" CHECK ("id" = 1),
  CONSTRAINT "StockAutoridad_modo" CHECK (
    "modo" IN ('APP_DUAL_WRITE', 'DB_PROJECTION')
  )
);

INSERT INTO public."StockAutoridad" ("id", "modo")
VALUES (1, 'APP_DUAL_WRITE');

REVOKE ALL ON TABLE public."StockAutoridad" FROM PUBLIC;

COMMENT ON TABLE public."StockAutoridad" IS
  'T14 stock authority capability. APP_DUAL_WRITE expects no projection trigger; DB_PROJECTION expects an active projection.';

COMMIT;
