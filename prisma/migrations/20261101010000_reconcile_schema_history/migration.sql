-- Reconcile schema objects that reached existing databases through db push or
-- manual SQL but were never represented in Prisma Migrate history.
-- Every operation is idempotent so the same migration also works on a database
-- that already has the current schema.

SET lock_timeout = '5s';
SET statement_timeout = '5min';

DO $$
BEGIN
  CREATE TYPE "EstadoGasto" AS ENUM ('PENDIENTE', 'PAGADO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "FrecuenciaGasto" AS ENUM ('UNICO', 'SEMANAL', 'MENSUAL', 'ANUAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "ShareLinkType" ADD VALUE IF NOT EXISTS 'REPORTE_DASHBOARD';
ALTER TYPE "ShareLinkType" ADD VALUE IF NOT EXISTS 'REPORTE_POS';
ALTER TYPE "ShareLinkType" ADD VALUE IF NOT EXISTS 'REPORTE_CONSIGNACION';
ALTER TYPE "ShareLinkType" ADD VALUE IF NOT EXISTS 'COMPROBANTE_GASTO';

ALTER TABLE "Branding"
  ADD COLUMN IF NOT EXISTS "isBannerSlider" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "whatsappMessage" TEXT
    DEFAULT 'Hola, estoy buscando {nombre_producto}';

ALTER TABLE "Categoria"
  ADD COLUMN IF NOT EXISTS "descuentos" JSONB,
  ADD COLUMN IF NOT EXISTS "sucursalId" INTEGER;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Categoria" WHERE "sucursalId" IS NULL)
     AND NOT EXISTS (SELECT 1 FROM "Sucursal" WHERE id = 1) THEN
    RAISE EXCEPTION
      'Cannot backfill Categoria.sucursalId: Sucursal id=1 does not exist';
  END IF;
END $$;

UPDATE "Categoria" SET "sucursalId" = 1 WHERE "sucursalId" IS NULL;
ALTER TABLE "Categoria" ALTER COLUMN "sucursalId" SET DEFAULT 1;
ALTER TABLE "Categoria" ALTER COLUMN "sucursalId" SET NOT NULL;

ALTER TABLE "Cliente"
  ADD COLUMN IF NOT EXISTS "codigoPostal" TEXT,
  ADD COLUMN IF NOT EXISTS "documento" TEXT,
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "localidad" TEXT,
  ADD COLUMN IF NOT EXISTS "provincia" TEXT;

ALTER TABLE "Configuracion"
  ADD COLUMN IF NOT EXISTS "andreaniCliente" TEXT,
  ADD COLUMN IF NOT EXISTS "andreaniContratoDomicilio" TEXT,
  ADD COLUMN IF NOT EXISTS "andreaniContratoSucursal" TEXT,
  ADD COLUMN IF NOT EXISTS "andreaniPassword" TEXT,
  ADD COLUMN IF NOT EXISTS "andreaniUsuario" TEXT,
  ADD COLUMN IF NOT EXISTS "mostrarPreciosConsignacion" BOOLEAN NOT NULL
    DEFAULT false;

ALTER TABLE "ConsignacionDetalle"
  ADD COLUMN IF NOT EXISTS "descuento" DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE "LiquidacionItem"
  ADD COLUMN IF NOT EXISTS "descuento" DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "sucursalId" INTEGER;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Notification" n
    LEFT JOIN "Producto" p ON p.id = n."productoId"
    LEFT JOIN "Usuario" u ON u.id = n."userId"
    WHERE n."sucursalId" IS NULL
      AND p."sucursalId" IS NOT NULL
      AND u."sucursalId" IS NOT NULL
      AND p."sucursalId" <> u."sucursalId"
  ) THEN
    RAISE EXCEPTION
      'Cannot infer Notification.sucursalId: product and user branches differ';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Notification" n
    LEFT JOIN "Producto" p ON p.id = n."productoId"
    LEFT JOIN "Usuario" u ON u.id = n."userId"
    WHERE n."sucursalId" IS NULL
      AND COALESCE(p."sucursalId", u."sucursalId") IS NULL
  ) AND NOT EXISTS (SELECT 1 FROM "Sucursal" WHERE id = 1) THEN
    RAISE EXCEPTION
      'Cannot backfill Notification.sucursalId: no branch can be inferred';
  END IF;
END $$;

UPDATE "Notification" n
SET "sucursalId" = COALESCE(
  (SELECT p."sucursalId" FROM "Producto" p WHERE p.id = n."productoId"),
  (SELECT u."sucursalId" FROM "Usuario" u WHERE u.id = n."userId"),
  1
)
WHERE n."sucursalId" IS NULL;
ALTER TABLE "Notification" ALTER COLUMN "sucursalId" SET DEFAULT 1;
ALTER TABLE "Notification" ALTER COLUMN "sucursalId" SET NOT NULL;

ALTER TABLE "Pago"
  ADD COLUMN IF NOT EXISTS "sucursalId" INTEGER,
  ADD COLUMN IF NOT EXISTS "tipo" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Pago" p
    JOIN "Cliente" c ON c.id = p."clienteId"
    JOIN "SesionCaja" s ON s.id = p."sesionCajaId"
    JOIN "Caja" ca ON ca.id = s."cajaId"
    WHERE c."sucursalId" <> ca."sucursalId"
  ) THEN
    RAISE EXCEPTION
      'Cannot infer Pago.sucursalId: client and cash-session branches differ';
  END IF;
END $$;

UPDATE "Pago" p
SET "sucursalId" = COALESCE(
  (
    SELECT ca."sucursalId"
    FROM "SesionCaja" s
    JOIN "Caja" ca ON ca.id = s."cajaId"
    WHERE s.id = p."sesionCajaId"
  ),
  (SELECT c."sucursalId" FROM "Cliente" c WHERE c.id = p."clienteId")
)
WHERE p."sucursalId" IS DISTINCT FROM COALESCE(
  (
    SELECT ca."sucursalId"
    FROM "SesionCaja" s
    JOIN "Caja" ca ON ca.id = s."cajaId"
    WHERE s.id = p."sesionCajaId"
  ),
  (SELECT c."sucursalId" FROM "Cliente" c WHERE c.id = p."clienteId")
);
UPDATE "Pago" SET "tipo" = 'VENTA' WHERE "tipo" IS NULL;
ALTER TABLE "Pago" ALTER COLUMN "sucursalId" SET DEFAULT 1;
ALTER TABLE "Pago" ALTER COLUMN "sucursalId" SET NOT NULL;
ALTER TABLE "Pago" ALTER COLUMN "tipo" SET DEFAULT 'VENTA';
ALTER TABLE "Pago" ALTER COLUMN "tipo" SET NOT NULL;

ALTER TABLE "Producto"
  ADD COLUMN IF NOT EXISTS "subcategoriaId" INTEGER;

ALTER TABLE "StoreSettings"
  ADD COLUMN IF NOT EXISTS "onlineStoreConfig" JSONB;

ALTER TABLE "Venta"
  ADD COLUMN IF NOT EXISTS "anulada" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "descuentoGlobal" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "fechaAnulacion" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "motivoAnulacion" TEXT,
  ADD COLUMN IF NOT EXISTS "numeroVenta" INTEGER;

ALTER TABLE "VentaDetalle"
  ADD COLUMN IF NOT EXISTS "descuento" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "esRotura" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "BrandingBanner" (
  "id" SERIAL NOT NULL,
  "brandingId" INTEGER NOT NULL,
  "bannerData" BYTEA NOT NULL,
  "bannerMime" TEXT NOT NULL,
  "orden" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BrandingBanner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Subcategoria" (
  "id" SERIAL NOT NULL,
  "nombre" TEXT NOT NULL,
  "categoriaId" INTEGER NOT NULL,
  "descuentos" JSONB,
  CONSTRAINT "Subcategoria_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Envio" (
  "id" SERIAL NOT NULL,
  "ventaId" INTEGER NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
  "codigoSeguimiento" TEXT,
  "costo" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "metodoEnvio" TEXT NOT NULL,
  "direccionEnvio" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Envio_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CategoriaGasto" (
  "id" SERIAL NOT NULL,
  "nombre" TEXT NOT NULL,
  "sucursalId" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "CategoriaGasto_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Gasto" (
  "id" SERIAL NOT NULL,
  "monto" DECIMAL(10,2) NOT NULL,
  "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fechaVencimiento" TIMESTAMP(3),
  "motivo" TEXT NOT NULL,
  "estado" "EstadoGasto" NOT NULL DEFAULT 'PAGADO',
  "esRecurrente" BOOLEAN NOT NULL DEFAULT false,
  "frecuencia" "FrecuenciaGasto" NOT NULL DEFAULT 'UNICO',
  "categoriaGastoId" INTEGER NOT NULL,
  "sucursalId" INTEGER NOT NULL DEFAULT 1,
  "userId" INTEGER,
  "comprobanteUrl" TEXT,
  "cuotaActual" INTEGER,
  "cuotaTotal" INTEGER,
  "recurrenciaId" TEXT,
  "esCompartido" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Gasto_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GastoSucursal" (
  "id" SERIAL NOT NULL,
  "gastoId" INTEGER NOT NULL,
  "sucursalId" INTEGER NOT NULL,
  "montoProporcional" DECIMAL(10,2) NOT NULL,
  CONSTRAINT "GastoSucursal_pkey" PRIMARY KEY ("id")
);

DROP INDEX IF EXISTS "Categoria_nombre_key";

CREATE INDEX IF NOT EXISTS "BrandingBanner_brandingId_idx"
  ON "BrandingBanner"("brandingId");
CREATE INDEX IF NOT EXISTS "BrandingBanner_orden_idx"
  ON "BrandingBanner"("orden");
CREATE INDEX IF NOT EXISTS "Subcategoria_categoriaId_idx"
  ON "Subcategoria"("categoriaId");
CREATE UNIQUE INDEX IF NOT EXISTS "Subcategoria_nombre_categoriaId_key"
  ON "Subcategoria"("nombre", "categoriaId");
CREATE UNIQUE INDEX IF NOT EXISTS "Envio_ventaId_key" ON "Envio"("ventaId");
CREATE INDEX IF NOT EXISTS "Gasto_sucursalId_idx" ON "Gasto"("sucursalId");
CREATE INDEX IF NOT EXISTS "Gasto_categoriaGastoId_idx"
  ON "Gasto"("categoriaGastoId");
CREATE INDEX IF NOT EXISTS "Gasto_fecha_idx" ON "Gasto"("fecha");
CREATE INDEX IF NOT EXISTS "Gasto_estado_idx" ON "Gasto"("estado");
CREATE INDEX IF NOT EXISTS "Gasto_recurrenciaId_idx" ON "Gasto"("recurrenciaId");
CREATE INDEX IF NOT EXISTS "GastoSucursal_sucursalId_idx"
  ON "GastoSucursal"("sucursalId");
CREATE INDEX IF NOT EXISTS "GastoSucursal_gastoId_idx"
  ON "GastoSucursal"("gastoId");
CREATE UNIQUE INDEX IF NOT EXISTS "GastoSucursal_gastoId_sucursalId_key"
  ON "GastoSucursal"("gastoId", "sucursalId");
CREATE INDEX IF NOT EXISTS "CategoriaGasto_sucursalId_idx"
  ON "CategoriaGasto"("sucursalId");
CREATE UNIQUE INDEX IF NOT EXISTS "CategoriaGasto_nombre_sucursalId_key"
  ON "CategoriaGasto"("nombre", "sucursalId");
CREATE INDEX IF NOT EXISTS "Categoria_sucursalId_idx"
  ON "Categoria"("sucursalId");
CREATE UNIQUE INDEX IF NOT EXISTS "Categoria_nombre_sucursalId_key"
  ON "Categoria"("nombre", "sucursalId");
CREATE INDEX IF NOT EXISTS "Notification_sucursalId_idx"
  ON "Notification"("sucursalId");
CREATE INDEX IF NOT EXISTS "Pago_sucursalId_idx" ON "Pago"("sucursalId");
CREATE INDEX IF NOT EXISTS "Pago_tipo_idx" ON "Pago"("tipo");
CREATE INDEX IF NOT EXISTS "Producto_subcategoriaId_idx"
  ON "Producto"("subcategoriaId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'BrandingBanner_brandingId_fkey'
      AND conrelid = '"BrandingBanner"'::regclass
  ) THEN
    ALTER TABLE "BrandingBanner"
      ADD CONSTRAINT "BrandingBanner_brandingId_fkey"
      FOREIGN KEY ("brandingId") REFERENCES "Branding"("id")
      ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Notification_sucursalId_fkey'
      AND conrelid = '"Notification"'::regclass
  ) THEN
    ALTER TABLE "Notification"
      ADD CONSTRAINT "Notification_sucursalId_fkey"
      FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Producto_subcategoriaId_fkey'
      AND conrelid = '"Producto"'::regclass
  ) THEN
    ALTER TABLE "Producto"
      ADD CONSTRAINT "Producto_subcategoriaId_fkey"
      FOREIGN KEY ("subcategoriaId") REFERENCES "Subcategoria"("id")
      ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Categoria_sucursalId_fkey'
      AND conrelid = '"Categoria"'::regclass
  ) THEN
    ALTER TABLE "Categoria"
      ADD CONSTRAINT "Categoria_sucursalId_fkey"
      FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Subcategoria_categoriaId_fkey'
      AND conrelid = '"Subcategoria"'::regclass
  ) THEN
    ALTER TABLE "Subcategoria"
      ADD CONSTRAINT "Subcategoria_categoriaId_fkey"
      FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id")
      ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Envio_ventaId_fkey'
      AND conrelid = '"Envio"'::regclass
  ) THEN
    ALTER TABLE "Envio"
      ADD CONSTRAINT "Envio_ventaId_fkey"
      FOREIGN KEY ("ventaId") REFERENCES "Venta"("id")
      ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Pago_sucursalId_fkey'
      AND conrelid = '"Pago"'::regclass
  ) THEN
    ALTER TABLE "Pago"
      ADD CONSTRAINT "Pago_sucursalId_fkey"
      FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Gasto_categoriaGastoId_fkey'
      AND conrelid = '"Gasto"'::regclass
  ) THEN
    ALTER TABLE "Gasto"
      ADD CONSTRAINT "Gasto_categoriaGastoId_fkey"
      FOREIGN KEY ("categoriaGastoId") REFERENCES "CategoriaGasto"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Gasto_sucursalId_fkey'
      AND conrelid = '"Gasto"'::regclass
  ) THEN
    ALTER TABLE "Gasto"
      ADD CONSTRAINT "Gasto_sucursalId_fkey"
      FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Gasto_userId_fkey'
      AND conrelid = '"Gasto"'::regclass
  ) THEN
    ALTER TABLE "Gasto"
      ADD CONSTRAINT "Gasto_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "Usuario"("id")
      ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'GastoSucursal_gastoId_fkey'
      AND conrelid = '"GastoSucursal"'::regclass
  ) THEN
    ALTER TABLE "GastoSucursal"
      ADD CONSTRAINT "GastoSucursal_gastoId_fkey"
      FOREIGN KEY ("gastoId") REFERENCES "Gasto"("id")
      ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'GastoSucursal_sucursalId_fkey'
      AND conrelid = '"GastoSucursal"'::regclass
  ) THEN
    ALTER TABLE "GastoSucursal"
      ADD CONSTRAINT "GastoSucursal_sucursalId_fkey"
      FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CategoriaGasto_sucursalId_fkey'
      AND conrelid = '"CategoriaGasto"'::regclass
  ) THEN
    ALTER TABLE "CategoriaGasto"
      ADD CONSTRAINT "CategoriaGasto_sucursalId_fkey"
      FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;

ALTER TABLE "BrandingBanner" VALIDATE CONSTRAINT "BrandingBanner_brandingId_fkey";
ALTER TABLE "Notification" VALIDATE CONSTRAINT "Notification_sucursalId_fkey";
ALTER TABLE "Producto" VALIDATE CONSTRAINT "Producto_subcategoriaId_fkey";
ALTER TABLE "Categoria" VALIDATE CONSTRAINT "Categoria_sucursalId_fkey";
ALTER TABLE "Subcategoria" VALIDATE CONSTRAINT "Subcategoria_categoriaId_fkey";
ALTER TABLE "Envio" VALIDATE CONSTRAINT "Envio_ventaId_fkey";
ALTER TABLE "Pago" VALIDATE CONSTRAINT "Pago_sucursalId_fkey";
ALTER TABLE "Gasto" VALIDATE CONSTRAINT "Gasto_categoriaGastoId_fkey";
ALTER TABLE "Gasto" VALIDATE CONSTRAINT "Gasto_sucursalId_fkey";
ALTER TABLE "Gasto" VALIDATE CONSTRAINT "Gasto_userId_fkey";
ALTER TABLE "GastoSucursal" VALIDATE CONSTRAINT "GastoSucursal_gastoId_fkey";
ALTER TABLE "GastoSucursal" VALIDATE CONSTRAINT "GastoSucursal_sucursalId_fkey";
ALTER TABLE "CategoriaGasto" VALIDATE CONSTRAINT "CategoriaGasto_sucursalId_fkey";
