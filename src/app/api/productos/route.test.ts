import assert from "node:assert/strict";
import test, { before } from "node:test";

type Handler = typeof import("./route").handlePostProducto;
type Deps = NonNullable<Parameters<Handler>[1]>;

let handlePostProducto: Handler;

before(async () => {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:1/test";
  process.env.JWT_SECRET ??= "t15f-productos-only-secret-1234567890";
  ({ handlePostProducto } = await import("./route"));
});

test("creation fails closed on incompatible authority before creating the product", async (t) => {
  t.mock.method(console, "error", () => undefined);
  let created = false;

  const response = await handlePostProducto(
    new Request("http://localhost/api/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: "T15-F unit",
        precioVenta: 100,
        precioCosto: 50,
        stockDisponibleUnits: 1,
      }),
    }),
    {
      requireAuth: async () => ({
        ok: true as const,
        user: { sub: "1", rol: "ADMIN" as const },
        token: "t15f-token",
        activeSucursalId: 1,
        allowedSucursalIds: [1],
        isGlobalView: false,
      }),
      requireRole: () => true,
      isGlobalSucursalView: () => false,
      checkProductLimit: async () => ({ allowed: true }),
      obtenerConfiguracionGlobal: async () => ({
        rubroNegocio: null,
        minStockGlobal: 0,
      }),
      validarAtributosFijosProducto: () => null,
      sendNotification: async () => undefined,
      prisma: {
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            $queryRaw: async () => [
              { modo: "APP_DUAL_WRITE", projection: 1 },
            ],
            producto: {
              create: async () => {
                created = true;
                return { id: 1 };
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
  assert.equal(created, false);
});
