-- Migration: pago_idempotency_key
--
-- Un cobro manual reintentado (timeout del cliente, doble click, retry de red)
-- creaba un segundo Pago y volvía a descontar `Cliente.saldoCuenta`. La clave la
-- aporta el cliente; es opcional para no romper a los escritores existentes
-- (ventas, liquidaciones y webhooks crean pagos con la clave en NULL, y en
-- PostgreSQL varios NULL no colisionan).
--
-- Aditiva: columna nueva y índice único. No toca datos ni rellena filas.

ALTER TABLE "Pago" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "Pago_idempotencyKey_key" ON "Pago"("idempotencyKey");
