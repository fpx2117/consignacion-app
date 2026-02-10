-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'EXPIRATION_NEAR';
ALTER TYPE "NotificationType" ADD VALUE 'PRODUCT_EXPIRED';

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "fechaVencimiento" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Configuracion" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "minStockGlobal" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "Configuracion_pkey" PRIMARY KEY ("id")
);
