import assert from "node:assert/strict";
import test from "node:test";

import {
  claimWebhookEvent,
  releaseWebhookEvent,
  type WebhookEventStore,
} from "@/lib/webhooks/processed-events";

function storeWith(overrides: Partial<WebhookEventStore> = {}) {
  const inserted: string[] = [];
  const removed: string[] = [];
  const store: WebhookEventStore = {
    insert: async ({ provider, eventId }) => {
      inserted.push(`${provider}:${eventId}`);
    },
    remove: async ({ provider, eventId }) => {
      removed.push(`${provider}:${eventId}`);
    },
    ...overrides,
  };
  return { store, inserted, removed };
}

test("el primer reclamo procesa y el duplicado no", async (t) => {
  await t.test("evento nuevo", async () => {
    const { store, inserted } = storeWith();
    assert.equal(
      await claimWebhookEvent(store, { provider: "paypal", eventId: "evt-1" }),
      true,
    );
    assert.deepEqual(inserted, ["paypal:evt-1"]);
  });

  await t.test("duplicado por violación de unicidad", async () => {
    const { store } = storeWith({
      insert: async () => {
        const error = new Error("duplicate") as Error & { code?: string };
        error.code = "P2002";
        throw error;
      },
    });
    assert.equal(
      await claimWebhookEvent(store, { provider: "paypal", eventId: "evt-1" }),
      false,
    );
  });

  await t.test("otro error no se confunde con duplicado", async () => {
    const { store } = storeWith({
      insert: async () => {
        const error = new Error("connection lost") as Error & { code?: string };
        error.code = "P1001";
        throw error;
      },
    });
    await assert.rejects(
      claimWebhookEvent(store, { provider: "paypal", eventId: "evt-1" }),
      /connection lost/,
    );
  });
});

test("liberar el reclamo permite reprocesar", async () => {
  const { store, removed } = storeWith();
  await releaseWebhookEvent(store, { provider: "mercadopago", eventId: "123" });
  assert.deepEqual(removed, ["mercadopago:123"]);
});
