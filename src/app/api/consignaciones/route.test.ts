import assert from "node:assert/strict";
import test, { before } from "node:test";

type Handler = typeof import("./route").handlePostConsignacion;
type Deps = NonNullable<Parameters<Handler>[1]>;

let handlePostConsignacion: Handler;

before(async () => {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:1/test";
  process.env.JWT_SECRET ??= "t15c-consignacion-only-secret-1234567890";
  ({ handlePostConsignacion } = await import("./route"));
});

test("fails closed before creating a consignacion when stock authority is incompatible", async (t) => {
  t.mock.method(console, "error", () => undefined);
  let created = false;

  const response = await handlePostConsignacion(
    new Request("http://localhost/api/consignaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clienteId: 1,
        items: [{ productoId: 1, unitsEntregadas: 1 }],
      }),
    }),
    {
      prisma: {
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            $queryRaw: async () => [
              { modo: "APP_DUAL_WRITE", projection: 1 },
            ],
            consignacion: {
              create: async () => {
                created = true;
                return { id: 1 };
              },
            },
          }),
      },
      requireAuth: async () => ({
        ok: true as const,
        user: { sub: "1", rol: "ADMIN" as const },
        token: "t15c-token",
        activeSucursalId: 1,
        allowedSucursalIds: [1],
        isGlobalView: false,
      }),
      isGlobalSucursalView: () => false,
      checkFeature: async () => ({ allowed: true }),
      obtenerConfiguracionGlobal: async () => ({
        porcentajeAumentoConsignacion: 0,
      }),
      evaluateStockAlert: () => null,
      processNotificationQueue: async () => undefined,
    } as unknown as Deps,
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: "Autoridad de stock no disponible.",
  });
  assert.equal(created, false);
});
