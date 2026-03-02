-- AlterTable
ALTER TABLE "Branding" ADD COLUMN     "bannerData" BYTEA,
ADD COLUMN     "bannerMime" TEXT,
ADD COLUMN     "facebookUrl" TEXT,
ADD COLUMN     "instagramUrl" TEXT,
ADD COLUMN     "secondaryColor" TEXT NOT NULL DEFAULT '#3b82f6',
ADD COLUMN     "themeIdentifier" TEXT NOT NULL DEFAULT 'modern',
ADD COLUMN     "whatsappNumber" TEXT;

-- AlterTable
ALTER TABLE "Configuracion" ADD COLUMN     "mostrarCategoriasEnHeader" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tiendaLayout" TEXT NOT NULL DEFAULT 'grid';
