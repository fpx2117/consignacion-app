-- Add 'VENCIDO' to "EstadoSuscripcion"
ALTER TYPE "EstadoSuscripcion" ADD VALUE IF NOT EXISTS 'VENCIDO';

-- Add 'CONSIGNMENT_ALERT' to "NotificationType"
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CONSIGNMENT_ALERT';


-- CreateTable
CREATE TABLE "Sucursal" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "esPrincipal" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sucursal_pkey" PRIMARY KEY ("id")
);

-- Insert Default Sucursal (ID = 1) para satisfacer la llave foranea de la data existente
INSERT INTO "Sucursal" ("id", "nombre", "esPrincipal", "updatedAt") VALUES (1, 'Sede Principal', true, CURRENT_TIMESTAMP);


-- AlterTable
ALTER TABLE "Caja" ADD COLUMN     "sucursalId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "sucursalId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Configuracion" ADD COLUMN     "diasAvisoConsignacion" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "notificarConsignacionesActivas" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notificarLiquidaciones" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Consignacion" ADD COLUMN     "sucursalId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "MovimientoStock" ADD COLUMN     "sucursalId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "sucursalId" INTEGER;

-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "sucursalId" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ResetPasswordToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResetPasswordToken_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "StockSucursal" (
    "id" SERIAL NOT NULL,
    "productoId" INTEGER NOT NULL,
    "sucursalId" INTEGER NOT NULL,
    "stockDisponibleUnits" INTEGER NOT NULL DEFAULT 0,
    "stockConsignadoUnits" INTEGER NOT NULL DEFAULT 0,
    "stockMinUnits" INTEGER NOT NULL DEFAULT 0,
    "precioVentaOverride" DECIMAL(10,2),
    "precioCostoOverride" DECIMAL(10,2),

    CONSTRAINT "StockSucursal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResetPasswordToken_token_key" ON "ResetPasswordToken"("token");

-- CreateIndex
CREATE INDEX "ResetPasswordToken_email_idx" ON "ResetPasswordToken"("email");

-- CreateIndex
CREATE UNIQUE INDEX "StockSucursal_productoId_sucursalId_key" ON "StockSucursal"("productoId", "sucursalId");

-- CreateIndex
CREATE INDEX "Caja_sucursalId_idx" ON "Caja"("sucursalId");

-- CreateIndex
CREATE INDEX "Cliente_sucursalId_idx" ON "Cliente"("sucursalId");

-- CreateIndex
CREATE INDEX "Consignacion_sucursalId_idx" ON "Consignacion"("sucursalId");

-- CreateIndex
CREATE INDEX "MovimientoStock_sucursalId_idx" ON "MovimientoStock"("sucursalId");

-- CreateIndex
CREATE INDEX "Usuario_sucursalId_idx" ON "Usuario"("sucursalId");

-- CreateIndex
CREATE INDEX "Venta_sucursalId_idx" ON "Venta"("sucursalId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoStock" ADD CONSTRAINT "MovimientoStock_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caja" ADD CONSTRAINT "Caja_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consignacion" ADD CONSTRAINT "Consignacion_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockSucursal" ADD CONSTRAINT "StockSucursal_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockSucursal" ADD CONSTRAINT "StockSucursal_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
