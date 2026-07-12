-- AlterTable
ALTER TABLE "Configuracion" ADD COLUMN     "mostrarEnTiendaOnline" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Configuracion" ADD COLUMN     "tiendaSlug" TEXT;

-- Backfill: heredar el estado actual de "catálogo público habilitado" como opt-in inicial,
-- para que ninguna sucursal que ya tenía el catálogo activo quede oculta tras el deploy.
UPDATE "Configuracion" SET "mostrarEnTiendaOnline" = "mostrarListaPrecios";

-- CreateIndex
CREATE UNIQUE INDEX "Configuracion_tiendaSlug_key" ON "Configuracion"("tiendaSlug");

-- CreateTable
CREATE TABLE "TiendaGlobalConfig" (
    "id" SERIAL NOT NULL,
    "modoUnificado" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TiendaGlobalConfig_pkey" PRIMARY KEY ("id")
);

-- Seed singleton row (id=1)
INSERT INTO "TiendaGlobalConfig" ("id", "modoUnificado", "updatedAt") VALUES (1, true, CURRENT_TIMESTAMP);
