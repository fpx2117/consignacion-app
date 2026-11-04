import assert from "node:assert/strict";
import test from "node:test";

import { checkSessionValidity, type SessionLookup } from "@/lib/auth/session-validity";
import { getSessionHash } from "@/lib/security/session-hash";

const NOW = new Date("2026-11-04T12:00:00.000Z");

function lookupFor(
  session: { isActive: boolean; expiresAt: Date } | null,
): { lookup: SessionLookup; received: string[] } {
  const received: string[] = [];
  return {
    received,
    lookup: {
      findSession: async (tokenHash) => {
        received.push(tokenHash);
        return session;
      },
    },
  };
}

test("la validez de sesión distingue los cuatro estados", async (t) => {
  await t.test("activa", async () => {
    const { lookup } = lookupFor({
      isActive: true,
      expiresAt: new Date("2026-11-05T00:00:00.000Z"),
    });
    assert.equal(await checkSessionValidity("token", lookup, NOW), "active");
  });

  await t.test("revocada", async () => {
    const { lookup } = lookupFor({
      isActive: false,
      expiresAt: new Date("2026-11-05T00:00:00.000Z"),
    });
    assert.equal(await checkSessionValidity("token", lookup, NOW), "revoked");
  });

  await t.test("vencida", async () => {
    const { lookup } = lookupFor({
      isActive: true,
      expiresAt: new Date("2026-11-04T11:59:59.000Z"),
    });
    assert.equal(await checkSessionValidity("token", lookup, NOW), "expired");
  });

  await t.test("inexistente", async () => {
    const { lookup } = lookupFor(null);
    assert.equal(await checkSessionValidity("token", lookup, NOW), "missing");
  });
});

test("el lookup recibe el hash de la sesión, nunca el token", async () => {
  const { lookup, received } = lookupFor({
    isActive: true,
    expiresAt: new Date("2026-11-05T00:00:00.000Z"),
  });

  await checkSessionValidity("jwt-crudo", lookup, NOW);

  assert.deepEqual(received, [getSessionHash("jwt-crudo")]);
  assert.notEqual(received[0], "jwt-crudo");
  assert.match(received[0], /^[a-f0-9]{64}$/);
});
