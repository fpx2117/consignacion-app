import assert from "node:assert/strict";
import test, { before } from "node:test";

type Handler = typeof import("./route").handlePutProducto;
type Deps = NonNullable<Parameters<Handler>[2]>;

let handlePutProducto: Handler;

before(async () => {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:1/test";
  process.env.JWT_SECRET ??= "t15f-productos-only-secret-1234567890";
  ({ handlePutProducto } = await import("./route"));
});

test("adjustment fails closed on incompatible authority before reading stock", async (t) => {
  t.mock.method(console, "error", () => undefined);
  let read = false;

  const response = await handlePutProducto(
    new Request("http://localhost/api/productos/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stockDisponibleUnits: 9,
        movimientoInfo: {
          tipo: "ENTRADA",
          motivo: "AJUSTE_POSITIVO",
        },
      }),
    }),
    { params: Promise.resolve({ id: "1" }) },
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
      obtenerConfiguracionGlobal: async () => ({
        rubroNegocio: null,
        minStockGlobal: 0,
      }),
      validarAtributosFijosProducto: () => null,
      deleteFileSystemImage: async () => undefined,
      sendNotification: async () => undefined,
      prisma: {
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            $queryRaw: async () => [
              { modo: "APP_DUAL_WRITE", projection: 1 },
            ],
            stockSucursal: {
              findUnique: async () => {
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
