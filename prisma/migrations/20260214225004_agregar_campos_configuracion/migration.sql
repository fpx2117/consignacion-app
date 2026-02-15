-- AlterTable
ALTER TABLE "Configuracion" ADD COLUMN     "diasAnticipacionVencimiento" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "notificarStockBajo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notificarVencimientos" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notificarVentas" BOOLEAN NOT NULL DEFAULT true;
