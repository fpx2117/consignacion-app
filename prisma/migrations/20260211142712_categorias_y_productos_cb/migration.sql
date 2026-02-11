/*
  Warnings:

  - A unique constraint covering the columns `[codigoBarra]` on the table `Producto` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[sku]` on the table `Producto` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "categoriaId" INTEGER,
ADD COLUMN     "codigoBarra" TEXT,
ADD COLUMN     "descripcion" TEXT,
ADD COLUMN     "iva" DECIMAL(5,2) NOT NULL DEFAULT 21.0,
ADD COLUMN     "sku" TEXT;

-- CreateTable
CREATE TABLE "Categoria" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nombre_key" ON "Categoria"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigoBarra_key" ON "Producto"("codigoBarra");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_sku_key" ON "Producto"("sku");

-- CreateIndex
CREATE INDEX "Producto_codigoBarra_idx" ON "Producto"("codigoBarra");

-- CreateIndex
CREATE INDEX "Producto_categoriaId_idx" ON "Producto"("categoriaId");

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;
