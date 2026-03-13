DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoPedidoEsperado') THEN
    CREATE TYPE "EstadoPedidoEsperado" AS ENUM (
      'PROGRAMADO',
      'VENCIDO',
      'PARCIAL',
      'CONFIRMADO',
      'POSTERGADO',
      'CANCELADO'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoItemPedido') THEN
    CREATE TYPE "EstadoItemPedido" AS ENUM (
      'PENDIENTE',
      'CONFIRMADO',
      'PARCIAL',
      'CANCELADO'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "PedidoEsperado" (
  "id" SERIAL NOT NULL,
  "sucursalId" INTEGER NOT NULL,
  "fechaEsperada" TIMESTAMP(3) NOT NULL,
  "observaciones" TEXT,
  "estado" "EstadoPedidoEsperado" NOT NULL DEFAULT 'PROGRAMADO',
  "creadoPor" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PedidoEsperado_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PedidoEsperadoItem" (
  "id" SERIAL NOT NULL,
  "pedidoId" INTEGER NOT NULL,
  "productoId" INTEGER NOT NULL,
  "cantidadEsperada" INTEGER NOT NULL,
  "cantidadRecibida" INTEGER NOT NULL DEFAULT 0,
  "estado" "EstadoItemPedido" NOT NULL DEFAULT 'PENDIENTE',
  CONSTRAINT "PedidoEsperadoItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PedidoEsperado_sucursalId_idx" ON "PedidoEsperado"("sucursalId");
CREATE INDEX IF NOT EXISTS "PedidoEsperado_estado_idx" ON "PedidoEsperado"("estado");
CREATE INDEX IF NOT EXISTS "PedidoEsperado_fechaEsperada_idx" ON "PedidoEsperado"("fechaEsperada");
CREATE INDEX IF NOT EXISTS "PedidoEsperadoItem_pedidoId_idx" ON "PedidoEsperadoItem"("pedidoId");
CREATE INDEX IF NOT EXISTS "PedidoEsperadoItem_productoId_idx" ON "PedidoEsperadoItem"("productoId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PedidoEsperado_sucursalId_fkey'
  ) THEN
    ALTER TABLE "PedidoEsperado"
      ADD CONSTRAINT "PedidoEsperado_sucursalId_fkey"
      FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PedidoEsperadoItem_pedidoId_fkey'
  ) THEN
    ALTER TABLE "PedidoEsperadoItem"
      ADD CONSTRAINT "PedidoEsperadoItem_pedidoId_fkey"
      FOREIGN KEY ("pedidoId") REFERENCES "PedidoEsperado"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PedidoEsperadoItem_productoId_fkey'
  ) THEN
    ALTER TABLE "PedidoEsperadoItem"
      ADD CONSTRAINT "PedidoEsperadoItem_productoId_fkey"
      FOREIGN KEY ("productoId") REFERENCES "Producto"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
