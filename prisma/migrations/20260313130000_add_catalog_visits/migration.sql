-- CreateTable
CREATE TABLE "CatalogVisit" (
    "id" SERIAL NOT NULL,
    "sucursalId" INTEGER NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "bucketStart" TIMESTAMP(3) NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'public_lista',

    CONSTRAINT "CatalogVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CatalogVisit_sucursalId_visitorHash_bucketStart_key" ON "CatalogVisit"("sucursalId", "visitorHash", "bucketStart");

-- CreateIndex
CREATE INDEX "CatalogVisit_sucursalId_visitedAt_idx" ON "CatalogVisit"("sucursalId", "visitedAt");

-- AddForeignKey
ALTER TABLE "CatalogVisit" ADD CONSTRAINT "CatalogVisit_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
