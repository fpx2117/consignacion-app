-- AlterTable: advertencias de validación aritmética post-extracción por línea de factura.
ALTER TABLE "FacturaProveedorItem" ADD COLUMN     "advertencias" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
