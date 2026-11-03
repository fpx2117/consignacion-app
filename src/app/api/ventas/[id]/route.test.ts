import assert from "node:assert/strict";
import test, { before } from "node:test";

type Handler = typeof import("./route").handleDeleteVenta;
type Deps = NonNullable<Parameters<Handler>[2]>;

let handleDeleteVenta: Handler;

before(async () => {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:1/test";
  process.env.JWT_SECRET ??= "t13-cancellation-only-secret-1234567890";
  ({ handleDeleteVenta } = await import("./route"));
});

test("preserves the invalid cancellation id contract through the handler seam", async () => {
  const response = await handleDeleteVenta(
    new Request("http://localhost/api/ventas/invalid", { method: "DELETE" }),
    { params: Promise.resolve({ id: "invalid" }) },
    {
      requireAuth: async () => ({
        ok: true as const,
        user: { sub: "1", rol: "ADMIN" as const },
        activeSucursalId: 1,
        allowedSucursalIds: [1],
        isGlobalView: false,
        token: "test",
      }),
      isGlobalSucursalView: () => false,
    } as unknown as Deps,
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "ID inválido" });
});

test("fails closed on an incompatible stock authority before claiming the sale", async (t) => {
  t.mock.method(console, "error", () => undefined);
  let claimed = false;

  const response = await handleDeleteVenta(
    new Request("http://localhost/api/ventas/1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo: "T15-B authority check" }),
    }),
    { params: Promise.resolve({ id: "1" }) },
    {
      requireAuth: async () => ({
        ok: true as const,
        user: { sub: "1", rol: "ADMIN" as const },
        activeSucursalId: 1,
        allowedSucursalIds: [1],
        isGlobalView: false,
        token: "test",
      }),
      isGlobalSucursalView: () => false,
      resolveTimezoneForAuth: async () => ({ tz: "America/Bogota" }),
      nowAR: () => new Date("2026-11-02T12:00:00.000Z"),
      prisma: {
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            $queryRaw: async () => [
              { modo: "APP_DUAL_WRITE", projection: 1 },
            ],
            venta: {
              updateMany: async () => {
                claimed = true;
                return { count: 1 };
              },
            },
          }),
      },
    } as unknown as Deps,
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: "Autoridad de stock no disponible.",
  });
  assert.equal(claimed, false);
});
