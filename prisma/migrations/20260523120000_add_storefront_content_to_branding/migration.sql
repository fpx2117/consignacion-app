-- AlterTable (idempotente)
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

-- CreateIndex (idempotente, compatible con cualquier versión de PostgreSQL)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'StoreSettings_sucursalId_key'
    ) THEN
        CREATE UNIQUE INDEX "StoreSettings_sucursalId_key"
        ON "StoreSettings"("sucursalId");
    END IF;
END $$;

-- AddForeignKey (idempotente, compatible con cualquier versión de PostgreSQL)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'StoreSettings_sucursalId_fkey'
    ) THEN
        ALTER TABLE "StoreSettings"
        ADD CONSTRAINT "StoreSettings_sucursalId_fkey"
        FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
