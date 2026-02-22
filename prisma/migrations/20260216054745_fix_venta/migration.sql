-- CreateEnum
CREATE TYPE "TipoVenta" AS ENUM ('CASUAL', 'LIQUIDACION');

-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "tipo" "TipoVenta" NOT NULL DEFAULT 'CASUAL',
ALTER COLUMN "sesionCajaId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Venta_tipo_idx" ON "Venta"("tipo");
