import assert from "node:assert/strict";
import test from "node:test";
import {
  assertVentaNumberingAuthority,
  createVentaWithAuthority,
  VENTA_NUMBERING_AUTHORITY_REQUIRED,
} from "./venta-numbering-authority";

test("accepts a complete enabled Venta numbering authority", async () => {
  const tx = {
    $executeRaw: async () => 0,
    $queryRaw: async () => [{ ready: true }],
  };

  await assert.doesNotReject(() => assertVentaNumberingAuthority(tx));
});

test("fails closed when Venta numbering authority is absent", async () => {
  const tx = {
    $executeRaw: async () => 0,
    $queryRaw: async () => [{ ready: false }],
  };

  await assert.rejects(
    () => assertVentaNumberingAuthority(tx),
    new RegExp(VENTA_NUMBERING_AUTHORITY_REQUIRED),
  );
});

test("locks, verifies, and creates through one authority boundary", async () => {
  const events: string[] = [];
  const tx = {
    $executeRaw: async () => {
      events.push("lock");
      return 0;
    },
    $queryRaw: async () => {
      events.push("verify");
      return [{ ready: true }];
    },
    venta: {
      create: async () => {
        events.push("create");
        return { id: 1, numeroVenta: 9 };
      },
    },
  };

  await createVentaWithAuthority(tx as never, {
    data: { clienteId: 1, total: 10, sucursalId: 1 },
  });
  assert.deepEqual(events, ["lock", "lock", "verify", "create"]);
});

test("rejects any caller-provided numeroVenta", async () => {
  const tx = {
    $executeRaw: async () => 0,
    $queryRaw: async () => [{ ready: true }],
    venta: { create: async () => ({ id: 1 }) },
  };

  await assert.rejects(
    () =>
      createVentaWithAuthority(tx as never, {
        data: { clienteId: 1, total: 10, sucursalId: 1, numeroVenta: 77 },
      }),
    /numeroVenta must be omitted/,
  );
});
