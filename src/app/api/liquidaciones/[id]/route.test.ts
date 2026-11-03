import assert from "node:assert/strict";
import test, { before } from "node:test";

type Handler = typeof import("./route").handlePutLiquidacion;
type Deps = NonNullable<Parameters<Handler>[2]>;

let handlePutLiquidacion: Handler;

before(async () => {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:1/test";
  process.env.JWT_SECRET ??= "t15e-put-only-secret-1234567890";
  ({ handlePutLiquidacion } = await import("./route"));
});

test("correction fails closed on incompatible authority before reading the liquidation", async (t) => {
  t.mock.method(console, "error", () => undefined);
  let read = false;

  const response = await handlePutLiquidacion(
    new Request("http://localhost/api/liquidaciones/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            consignacionDetalleId: 1,
            unitsVendidas: 1,
            unitsDevueltas: 0,
          },
        ],
      }),
    }),
    { params: Promise.resolve({ id: "1" }) },
    {
      requireAuth: async () => ({
        ok: true as const,
        user: { sub: "1", rol: "ADMIN" as const },
        token: "t15e-token",
        activeSucursalId: 1,
        allowedSucursalIds: [1],
        isGlobalView: false,
      }),
      isGlobalSucursalView: () => false,
      obtenerConfiguracionGlobal: async () => ({ notificarVentas: false }),
      evaluateStockAlert: () => null,
      processNotificationQueue: async () => undefined,
      prisma: {
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            $queryRaw: async () => [
              { modo: "APP_DUAL_WRITE", projection: 1 },
            ],
            liquidacion: {
              findFirst: async () => {
                read = true;
                return null;
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
  assert.equal(read, false);
});
