-- AlterTable: agregar columnas de descuento a Producto
ALTER TABLE "Producto"
  ADD COLUMN IF NOT EXISTS "descuentoPorcentaje" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "descuentoMonto" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "tipoDescuento" TEXT NOT NULL DEFAULT 'porcentaje',
  ADD COLUMN IF NOT EXISTS "descuentoActivo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "descuentoDesde" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "descuentoHasta" TIMESTAMP(3);
