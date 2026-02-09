/*
  Warnings:

  - Added the required column `numeroFolio` to the `Consignacion` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Consignacion" ADD COLUMN     "numeroFolio" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "Consignacion_clienteId_numeroFolio_idx" ON "Consignacion"("clienteId", "numeroFolio");
