-- AlterTable
ALTER TABLE "PlanLimit" ADD COLUMN     "maxFacturasOcr" INTEGER NOT NULL DEFAULT 0;

-- Backfill: el plan Enterprise (id 3) habilita la carga de facturas con OCR/IA
-- con un cupo mensual de 400 escaneos. Básico y Pro quedan en 0 (sin acceso).
UPDATE "PlanLimit"
SET "maxFacturasOcr" = 400
WHERE "planId" = 3;
