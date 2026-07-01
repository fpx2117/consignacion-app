-- AlterTable: marca si el binario original de la factura ya fue purgado del disco.
ALTER TABLE "FacturaProveedor" ADD COLUMN     "archivoEliminado" BOOLEAN NOT NULL DEFAULT false;
