-- AlterTable: Proveedor pasa a ser por sucursal (antes global al negocio).
-- Nullable con default 1 (sucursal principal): migración aditiva, sin backfill
-- manual, sin downtime. Los proveedores existentes quedan asignados a la
-- sucursal principal automáticamente.
ALTER TABLE "Proveedor" ADD COLUMN     "sucursalId" INTEGER DEFAULT 1;

-- CreateIndex
CREATE INDEX "Proveedor_sucursalId_idx" ON "Proveedor"("sucursalId");

-- AddForeignKey
ALTER TABLE "Proveedor" ADD CONSTRAINT "Proveedor_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
