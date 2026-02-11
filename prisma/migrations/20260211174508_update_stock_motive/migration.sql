-- CreateEnum
CREATE TYPE "TipoMovimientoStock" AS ENUM ('ENTRADA', 'SALIDA');

-- CreateEnum
CREATE TYPE "MotivoMovimientoStock" AS ENUM ('COMPRA', 'DEVOLUCION_CLIENTE', 'AJUSTE_POSITIVO', 'ROTURA', 'VENCIMIENTO', 'PERDIDA', 'AJUSTE_NEGATIVO', 'VENTA', 'CONSIGNACION');

-- CreateTable
CREATE TABLE "MovimientoStock" (
    "id" SERIAL NOT NULL,
    "productoId" INTEGER NOT NULL,
    "tipo" "TipoMovimientoStock" NOT NULL,
    "motivo" "MotivoMovimientoStock" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "stockPrevio" INTEGER NOT NULL,
    "stockPosterior" INTEGER NOT NULL,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MovimientoStock_productoId_idx" ON "MovimientoStock"("productoId");

-- CreateIndex
CREATE INDEX "MovimientoStock_createdAt_idx" ON "MovimientoStock"("createdAt");

-- AddForeignKey
ALTER TABLE "MovimientoStock" ADD CONSTRAINT "MovimientoStock_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
