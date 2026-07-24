-- AlterTable: FacturaProveedor — rubro copiado (no referenciado) al momento de
-- procesar, y snapshot congelado de la cabecera tal como la propuso la IA, para
-- poder medir tasa de corrección humana por rubro con el tiempo.
ALTER TABLE "FacturaProveedor" ADD COLUMN "rubroNegocio" TEXT;
ALTER TABLE "FacturaProveedor" ADD COLUMN "valoresIaOriginal" JSONB;

-- AlterTable: FacturaProveedorItem — mismo snapshot a nivel de item.
ALTER TABLE "FacturaProveedorItem" ADD COLUMN "valoresIaOriginal" JSONB;
