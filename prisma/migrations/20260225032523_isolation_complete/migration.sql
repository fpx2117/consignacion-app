/*
  Warnings:

  - A unique constraint covering the columns `[nombre,sucursalId]` on the table `Categoria` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Categoria_nombre_key";

-- AlterTable
ALTER TABLE "Categoria" ADD COLUMN     "sucursalId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "sucursalId" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "Categoria_sucursalId_idx" ON "Categoria"("sucursalId");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nombre_sucursalId_key" ON "Categoria"("nombre", "sucursalId");

-- CreateIndex
CREATE INDEX "Producto_sucursalId_idx" ON "Producto"("sucursalId");

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
