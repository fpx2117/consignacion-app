-- AlterTable
ALTER TABLE "Configuracion" ADD COLUMN     "tiendaMetodoPago" TEXT NOT NULL DEFAULT 'whatsapp';

-- Backfill: las tiendas que ya tenían credenciales de Mercado Pago cargadas
-- mantienen ese método activo en vez de pasar silenciosamente a WhatsApp.
UPDATE "Configuracion"
SET "tiendaMetodoPago" = 'mercadopago'
WHERE COALESCE(NULLIF(TRIM("mpAccessTokenTienda"), ''), '') <> ''
  AND COALESCE(NULLIF(TRIM("mpPublicKeyTienda"), ''), '') <> '';
