/*
  Warnings:

  - A unique constraint covering the columns `[sucursalId]` on the table `Configuracion` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
CREATE SEQUENCE configuracion_id_seq;
ALTER TABLE "Configuracion" ADD COLUMN     "sucursalId" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "id" SET DEFAULT nextval('configuracion_id_seq');
ALTER SEQUENCE configuracion_id_seq OWNED BY "Configuracion"."id";

-- CreateIndex
CREATE UNIQUE INDEX "Configuracion_sucursalId_key" ON "Configuracion"("sucursalId");

-- AddForeignKey
ALTER TABLE "Configuracion" ADD CONSTRAINT "Configuracion_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
