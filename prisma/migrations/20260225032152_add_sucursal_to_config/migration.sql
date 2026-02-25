/*
  Warnings:

  - A unique constraint covering the columns `[sucursalId]` on the table `Configuracion` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Configuracion" ADD COLUMN     "sucursalId" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "Configuracion_sucursalId_key" ON "Configuracion"("sucursalId");

-- AddForeignKey
ALTER TABLE "Configuracion" ADD CONSTRAINT "Configuracion_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
