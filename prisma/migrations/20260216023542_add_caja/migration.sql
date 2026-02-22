/*
  Warnings:

  - Added the required column `sesionCajaId` to the `Venta` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EstadoSesionCaja" AS ENUM ('ABIERTA', 'CERRADA');

-- CreateEnum
CREATE TYPE "TipoMovimientoCaja" AS ENUM ('INGRESO', 'EGRESO');

-- AlterTable
ALTER TABLE "Pago" ADD COLUMN     "sesionCajaId" INTEGER;

-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "sesionCajaId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "Caja" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SesionCaja" (
    "id" SERIAL NOT NULL,
    "cajaId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "estado" "EstadoSesionCaja" NOT NULL DEFAULT 'ABIERTA',
    "fechaApertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCierre" TIMESTAMP(3),
    "montoInicial" DECIMAL(10,2) NOT NULL,
    "montoFinalEsperado" DECIMAL(10,2),
    "montoFinalReal" DECIMAL(10,2),
    "diferencia" DECIMAL(10,2),
    "observaciones" TEXT,

    CONSTRAINT "SesionCaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoCaja" (
    "id" SERIAL NOT NULL,
    "sesionCajaId" INTEGER NOT NULL,
    "tipo" "TipoMovimientoCaja" NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "motivo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoCaja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Caja_nombre_key" ON "Caja"("nombre");

-- CreateIndex
CREATE INDEX "SesionCaja_cajaId_estado_idx" ON "SesionCaja"("cajaId", "estado");

-- CreateIndex
CREATE INDEX "SesionCaja_usuarioId_fechaApertura_idx" ON "SesionCaja"("usuarioId", "fechaApertura");

-- CreateIndex
CREATE INDEX "MovimientoCaja_sesionCajaId_idx" ON "MovimientoCaja"("sesionCajaId");

-- CreateIndex
CREATE INDEX "Pago_sesionCajaId_idx" ON "Pago"("sesionCajaId");

-- CreateIndex
CREATE INDEX "Venta_sesionCajaId_idx" ON "Venta"("sesionCajaId");

-- AddForeignKey
ALTER TABLE "SesionCaja" ADD CONSTRAINT "SesionCaja_cajaId_fkey" FOREIGN KEY ("cajaId") REFERENCES "Caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SesionCaja" ADD CONSTRAINT "SesionCaja_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCaja" ADD CONSTRAINT "MovimientoCaja_sesionCajaId_fkey" FOREIGN KEY ("sesionCajaId") REFERENCES "SesionCaja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_sesionCajaId_fkey" FOREIGN KEY ("sesionCajaId") REFERENCES "SesionCaja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_sesionCajaId_fkey" FOREIGN KEY ("sesionCajaId") REFERENCES "SesionCaja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
