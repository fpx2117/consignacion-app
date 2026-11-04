-- Migration: webhook_events
--
-- Mercado Pago y PayPal reintentan la entrega de un evento hasta que reciben 2xx
-- y pueden entregarlo más de una vez. Sin un registro, un reintento vuelve a
-- aplicar efectos (notificación, actualización, y en el checkout la propia
-- idempotencia del intent ya lo cubre pero no el resto).
--
-- La clave (provider, eventId) es única. El handler reclama el evento antes de
-- procesar y lo libera si el procesamiento falla, para que el reintento pueda
-- volver a intentarlo.
--
-- Aditiva: tabla nueva, sin tocar datos existentes.

CREATE TABLE "WebhookEvent" (
  "id"        SERIAL NOT NULL,
  "provider"  TEXT NOT NULL,
  "eventId"   TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebhookEvent_provider_eventId_key"
  ON "WebhookEvent"("provider", "eventId");

CREATE INDEX "WebhookEvent_createdAt_idx" ON "WebhookEvent"("createdAt");
