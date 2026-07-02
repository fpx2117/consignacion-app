-- AlterTable: Configuracion — rubro de negocio (contexto para OCR/IA) y
-- columnas de atributos elegidas para la tabla de productos.
ALTER TABLE "Configuracion" ADD COLUMN "rubroNegocio" TEXT;
ALTER TABLE "Configuracion" ADD COLUMN "columnasAtributosProducto" TEXT[] NOT NULL DEFAULT '{}';

-- AlterTable: FacturaProveedorItem — atributos libres detectados por la IA
-- que no matchean ningún campo estándar (lote, vencimiento, talle, color, etc.)
ALTER TABLE "FacturaProveedorItem" ADD COLUMN "atributosExtra" JSONB;

-- AlterTable: Producto — mismo formato, editable desde el catálogo sin
-- depender de que el producto haya sido creado por OCR.
ALTER TABLE "Producto" ADD COLUMN "atributosExtra" JSONB;
