-- AlterTable
ALTER TABLE "Configuracion" ADD COLUMN     "convertirTienda" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mostrarListaPrecios" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mpAccessTokenTienda" TEXT,
ADD COLUMN     "mpPublicKeyTienda" TEXT,
ADD COLUMN     "separarListaPorSucursal" BOOLEAN NOT NULL DEFAULT true;
