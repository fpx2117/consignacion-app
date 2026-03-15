-- Migración: configuracion_zona_horaria
-- Agrega zonaHoraria y timezoneMigrationDone al modelo Configuracion
-- Forward-compatible: no destructiva para filas existentes

ALTER TABLE "Configuracion" ADD COLUMN IF NOT EXISTS "zonaHoraria" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires';
ALTER TABLE "Configuracion" ADD COLUMN IF NOT EXISTS "timezoneMigrationDone" BOOLEAN NOT NULL DEFAULT false;
