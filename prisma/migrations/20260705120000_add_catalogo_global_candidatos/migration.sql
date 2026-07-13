-- AlterTable: sugerencia de catalogo-global-api (informativa, solo cuando no hubo match local).
ALTER TABLE "FacturaProveedorItem" ADD COLUMN     "candidatoGlobalId" TEXT,
ADD COLUMN     "candidatoGlobalNombre" TEXT,
ADD COLUMN     "candidatoGlobalCodigoBarras" TEXT,
ADD COLUMN     "candidatoGlobalScore" DOUBLE PRECISION;

-- AlterTable: trazabilidad de qué ProductoGlobal originó este alias, si corresponde.
ALTER TABLE "ProductoProveedorAlias" ADD COLUMN     "productoGlobalId" TEXT;
