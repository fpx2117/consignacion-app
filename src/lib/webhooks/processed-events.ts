// src/lib/webhooks/processed-events.ts
// Registro de eventos de webhook ya procesados.
//
// Los proveedores reintentan hasta recibir 2xx y pueden entregar el mismo evento
// más de una vez. El handler reclama el evento antes de procesar; si el
// procesamiento falla, lo libera para que el reintento pueda volver a intentarlo.
// Así el reintento exitoso se procesa una sola vez y el fallido no queda
// bloqueado.

export type WebhookEventStore = {
  insert: (input: { provider: string; eventId: string }) => Promise<void>;
  remove: (input: { provider: string; eventId: string }) => Promise<void>;
};

function isUniqueViolation(error: unknown) {
  const candidate = error as { code?: unknown } | null;
  return candidate?.code === "P2002";
}

/**
 * Devuelve `true` si este proceso se queda con el evento, `false` si ya estaba
 * registrado (entrega duplicada).
 */
export async function claimWebhookEvent(
  store: WebhookEventStore,
  input: { provider: string; eventId: string },
): Promise<boolean> {
  try {
    await store.insert(input);
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

/** Libera el reclamo para que el reintento del proveedor pueda procesarlo. */
export async function releaseWebhookEvent(
  store: WebhookEventStore,
  input: { provider: string; eventId: string },
): Promise<void> {
  await store.remove(input);
}

/** Store real sobre Prisma, con import diferido para no cargar Prisma al importar. */
export const prismaWebhookEventStore: WebhookEventStore = {
  insert: async ({ provider, eventId }) => {
    const { prisma } = await import("@/lib/prisma");
    await prisma.webhookEvent.create({ data: { provider, eventId } });
  },
  remove: async ({ provider, eventId }) => {
    const { prisma } = await import("@/lib/prisma");
    await prisma.webhookEvent.deleteMany({ where: { provider, eventId } });
  },
};
