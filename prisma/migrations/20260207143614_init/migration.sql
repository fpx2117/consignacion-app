-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'EMPLEADO');

-- CreateEnum
CREATE TYPE "EstadoConsignacion" AS ENUM ('ABIERTA', 'CERRADA');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'OTRO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'EMPLEADO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "direccion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "saldoCuenta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "precioVenta" DECIMAL(10,2) NOT NULL,
    "precioCosto" DECIMAL(10,2) NOT NULL,
    "stockDisponibleUnits" INTEGER NOT NULL DEFAULT 0,
    "stockConsignadoUnits" INTEGER NOT NULL DEFAULT 0,
    "packSizeUnits" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consignacion" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoConsignacion" NOT NULL DEFAULT 'ABIERTA',

    CONSTRAINT "Consignacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsignacionDetalle" (
    "id" SERIAL NOT NULL,
    "consignacionId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "unitsEntregadas" INTEGER NOT NULL,
    "unitsVendidasAcum" INTEGER NOT NULL DEFAULT 0,
    "unitsDevueltasAcum" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ConsignacionDetalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Liquidacion" (
    "id" SERIAL NOT NULL,
    "consignacionId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Liquidacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquidacionItem" (
    "id" SERIAL NOT NULL,
    "liquidacionId" INTEGER NOT NULL,
    "consignacionDetalleId" INTEGER NOT NULL,
    "unitsVendidas" INTEGER NOT NULL DEFAULT 0,
    "unitsDevueltas" INTEGER NOT NULL DEFAULT 0,
    "precioUnitario" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "LiquidacionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venta" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "liquidacionId" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "Venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VentaDetalle" (
    "id" SERIAL NOT NULL,
    "ventaId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "units" INTEGER NOT NULL,
    "precioUnitario" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "VentaDetalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" DECIMAL(10,2) NOT NULL,
    "metodo" "MetodoPago" NOT NULL,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_rol_idx" ON "Usuario"("rol");

-- CreateIndex
CREATE INDEX "Consignacion_clienteId_fecha_idx" ON "Consignacion"("clienteId", "fecha");

-- CreateIndex
CREATE INDEX "Consignacion_estado_fecha_idx" ON "Consignacion"("estado", "fecha");

-- CreateIndex
CREATE INDEX "ConsignacionDetalle_consignacionId_idx" ON "ConsignacionDetalle"("consignacionId");

-- CreateIndex
CREATE INDEX "ConsignacionDetalle_productoId_idx" ON "ConsignacionDetalle"("productoId");

-- CreateIndex
CREATE INDEX "Liquidacion_consignacionId_fecha_idx" ON "Liquidacion"("consignacionId", "fecha");

-- CreateIndex
CREATE INDEX "LiquidacionItem_liquidacionId_idx" ON "LiquidacionItem"("liquidacionId");

-- CreateIndex
CREATE INDEX "LiquidacionItem_consignacionDetalleId_idx" ON "LiquidacionItem"("consignacionDetalleId");

-- CreateIndex
CREATE UNIQUE INDEX "Venta_liquidacionId_key" ON "Venta"("liquidacionId");

-- CreateIndex
CREATE INDEX "Venta_clienteId_fecha_idx" ON "Venta"("clienteId", "fecha");

-- CreateIndex
CREATE INDEX "VentaDetalle_ventaId_idx" ON "VentaDetalle"("ventaId");

-- CreateIndex
CREATE INDEX "VentaDetalle_productoId_idx" ON "VentaDetalle"("productoId");

-- CreateIndex
CREATE INDEX "Pago_clienteId_fecha_idx" ON "Pago"("clienteId", "fecha");

-- AddForeignKey
ALTER TABLE "Consignacion" ADD CONSTRAINT "Consignacion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsignacionDetalle" ADD CONSTRAINT "ConsignacionDetalle_consignacionId_fkey" FOREIGN KEY ("consignacionId") REFERENCES "Consignacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsignacionDetalle" ADD CONSTRAINT "ConsignacionDetalle_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liquidacion" ADD CONSTRAINT "Liquidacion_consignacionId_fkey" FOREIGN KEY ("consignacionId") REFERENCES "Consignacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidacionItem" ADD CONSTRAINT "LiquidacionItem_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "Liquidacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidacionItem" ADD CONSTRAINT "LiquidacionItem_consignacionDetalleId_fkey" FOREIGN KEY ("consignacionDetalleId") REFERENCES "ConsignacionDetalle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "Liquidacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaDetalle" ADD CONSTRAINT "VentaDetalle_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaDetalle" ADD CONSTRAINT "VentaDetalle_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
