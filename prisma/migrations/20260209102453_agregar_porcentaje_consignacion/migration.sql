-- AlterTable
ALTER TABLE "Consignacion" ADD COLUMN     "porcentajeAumento" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ConsignacionDetalle" ADD COLUMN     "precioUnitario" DECIMAL(10,2) NOT NULL DEFAULT 0;
