-- AlterTable
ALTER TABLE "Branding" ADD COLUMN "sucursalId" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "Branding_sucursalId_key" ON "Branding"("sucursalId");

-- AddForeignKey
ALTER TABLE "Branding" ADD CONSTRAINT "Branding_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
