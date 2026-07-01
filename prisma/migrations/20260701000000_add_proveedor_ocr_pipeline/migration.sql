-- CreateEnum
CREATE TYPE "EstadoFacturaProveedor" AS ENUM ('PENDIENTE', 'PROCESANDO', 'REQUIERE_REVISION', 'CONFIRMADA', 'CANCELADA', 'ERROR');

-- CreateEnum
CREATE TYPE "EstadoItemFactura" AS ENUM ('PENDIENTE', 'COINCIDENCIA_SEGURA', 'COINCIDENCIA_PROBABLE', 'REQUIERE_REVISION', 'SIN_COINCIDENCIA', 'PRODUCTO_CREADO', 'IGNORADO', 'CONFIRMADO', 'ERROR');

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "fechaUltimaCompra" TIMESTAMP(3),
ADD COLUMN     "monedaCosto" TEXT NOT NULL DEFAULT 'ARS',
ADD COLUMN     "ultimoCostoCompra" DECIMAL(12,4);

-- CreateTable
CREATE TABLE "Proveedor" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "cuit" TEXT,
    "monedaPreferida" TEXT NOT NULL DEFAULT 'ARS',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacturaProveedor" (
    "id" SERIAL NOT NULL,
    "proveedorId" INTEGER,
    "sucursalId" INTEGER NOT NULL,
    "archivoPath" TEXT NOT NULL,
    "archivoMime" TEXT NOT NULL,
    "numeroFactura" TEXT,
    "fecha" TIMESTAMP(3),
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "totalDetectado" DECIMAL(12,2),
    "ocrTextoCompleto" TEXT,
    "estado" "EstadoFacturaProveedor" NOT NULL DEFAULT 'PENDIENTE',
    "confianzaOcr" DOUBLE PRECISION,
    "errorMensaje" TEXT,
    "modalJobId" TEXT,
    "creadoPor" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacturaProveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacturaProveedorItem" (
    "id" SERIAL NOT NULL,
    "facturaId" INTEGER NOT NULL,
    "productoId" INTEGER,
    "textoOriginal" TEXT NOT NULL,
    "descripcionNormalizada" TEXT,
    "codigoProveedor" TEXT,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" DECIMAL(12,4),
    "totalLinea" DECIMAL(12,2),
    "confianzaExtraccion" DOUBLE PRECISION,
    "matchScore" DOUBLE PRECISION,
    "matchMotivo" TEXT,
    "estado" "EstadoItemFactura" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacturaProveedorItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductoProveedorAlias" (
    "id" SERIAL NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "codigoProveedor" TEXT,
    "textoNormalizado" TEXT,
    "usoCount" INTEGER NOT NULL DEFAULT 1,
    "confianza" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductoProveedorAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistorialCostoProducto" (
    "id" SERIAL NOT NULL,
    "productoId" INTEGER NOT NULL,
    "proveedorId" INTEGER,
    "facturaItemId" INTEGER,
    "costoAnterior" DECIMAL(12,4),
    "costoNuevo" DECIMAL(12,4) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "variacionPct" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistorialCostoProducto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Proveedor_activo_idx" ON "Proveedor"("activo");

-- CreateIndex
CREATE INDEX "Proveedor_nombre_idx" ON "Proveedor"("nombre");

-- CreateIndex
CREATE INDEX "FacturaProveedor_sucursalId_idx" ON "FacturaProveedor"("sucursalId");

-- CreateIndex
CREATE INDEX "FacturaProveedor_proveedorId_idx" ON "FacturaProveedor"("proveedorId");

-- CreateIndex
CREATE INDEX "FacturaProveedor_estado_idx" ON "FacturaProveedor"("estado");

-- CreateIndex
CREATE INDEX "FacturaProveedorItem_facturaId_idx" ON "FacturaProveedorItem"("facturaId");

-- CreateIndex
CREATE INDEX "FacturaProveedorItem_productoId_idx" ON "FacturaProveedorItem"("productoId");

-- CreateIndex
CREATE INDEX "FacturaProveedorItem_estado_idx" ON "FacturaProveedorItem"("estado");

-- CreateIndex
CREATE INDEX "ProductoProveedorAlias_proveedorId_textoNormalizado_idx" ON "ProductoProveedorAlias"("proveedorId", "textoNormalizado");

-- CreateIndex
CREATE INDEX "ProductoProveedorAlias_productoId_idx" ON "ProductoProveedorAlias"("productoId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductoProveedorAlias_proveedorId_codigoProveedor_key" ON "ProductoProveedorAlias"("proveedorId", "codigoProveedor");

-- CreateIndex
CREATE UNIQUE INDEX "HistorialCostoProducto_facturaItemId_key" ON "HistorialCostoProducto"("facturaItemId");

-- CreateIndex
CREATE INDEX "HistorialCostoProducto_productoId_createdAt_idx" ON "HistorialCostoProducto"("productoId", "createdAt");

-- AddForeignKey
ALTER TABLE "FacturaProveedor" ADD CONSTRAINT "FacturaProveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturaProveedor" ADD CONSTRAINT "FacturaProveedor_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturaProveedorItem" ADD CONSTRAINT "FacturaProveedorItem_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "FacturaProveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacturaProveedorItem" ADD CONSTRAINT "FacturaProveedorItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoProveedorAlias" ADD CONSTRAINT "ProductoProveedorAlias_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoProveedorAlias" ADD CONSTRAINT "ProductoProveedorAlias_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialCostoProducto" ADD CONSTRAINT "HistorialCostoProducto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

