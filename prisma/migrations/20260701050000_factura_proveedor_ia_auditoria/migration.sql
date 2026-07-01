-- AlterTable
-- Migra el motor de extracción de Modal a OpenRouter: se agregan columnas de
-- auditoría (respuesta cruda, modelo, tokens usados) y se elimina modalJobId,
-- que nunca llegó a usarse (no hay referencias en el código de aplicación).
ALTER TABLE "FacturaProveedor" DROP COLUMN IF EXISTS "modalJobId";
ALTER TABLE "FacturaProveedor" ADD COLUMN     "iaRespuestaCruda" JSONB,
ADD COLUMN     "iaModeloUsado" TEXT,
ADD COLUMN     "iaTokensUsados" INTEGER;
