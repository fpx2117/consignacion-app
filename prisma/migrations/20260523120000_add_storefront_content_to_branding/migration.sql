-- AlterTable (idempotente: la columna puede existir de un deploy previo)
ALTER TABLE "Branding"
ADD COLUMN IF NOT EXISTS "storefrontContent" JSONB;

-- CreateTable (idempotente)
CREATE TABLE IF NOT EXISTS "StoreSettings" (
    "id" SERIAL NOT NULL,
    "sucursalId" INTEGER NOT NULL,
    "themeConfig" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotente)
CREATE UNIQUE INDEX IF NOT EXISTS "StoreSettings_sucursalId_key" ON "StoreSettings"("sucursalId");

-- AddForeignKey (idempotente)
ALTER TABLE "StoreSettings"
ADD CONSTRAINT IF NOT EXISTS "StoreSettings_sucursalId_fkey"
FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
