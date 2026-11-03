import assert from "node:assert/strict";
import test, { before } from "node:test";

type PutHandler = typeof import("./route").handlePutConsignacion;
type PostHandler =
  typeof import("./route").handlePostLiquidacionConsignacion;
type Deps = NonNullable<Parameters<PutHandler>[2]>;

let handlePutConsignacion: PutHandler;
let handlePostLiquidacionConsignacion: PostHandler;

before(async () => {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:1/test";
  process.env.JWT_SECRET ??= "t15d-consignacion-only-secret-1234567890";
  ({ handlePutConsignacion, handlePostLiquidacionConsignacion } = await import(
    "./route"
  ));
});

function makeDeps(onRead: () => void) {
  return {
    requireAuth: async () => ({
      ok: true as const,
      user: { sub: "1", rol: "ADMIN" as const },
      token: "t15d-token",
      activeSucursalId: 1,
      allowedSucursalIds: [1],
      isGlobalView: false,
    }),
    isGlobalSucursalView: () => false,
    obtenerConfiguracionGlobal: async () => ({
      porcentajeAumentoConsignacion: 0,
    }),
    evaluateStockAlert: () => null,
    processNotificationQueue: async () => undefined,
    prisma: {
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          $queryRaw: async () => [{ modo: "APP_DUAL_WRITE", projection: 1 }],
          consignacion: {
            findFirst: async () => {
              onRead();
              return null;
            },
          },
        }),
    },
  } as unknown as Deps;
}

test("edit fails closed on incompatible authority before reading the consignacion", async (t) => {
  t.mock.method(console, "error", () => undefined);
  let read = false;

  const response = await handlePutConsignacion(
    new Request("http://localhost/api/consignaciones/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ productoId: 1, unitsEntregadas: 2 }],
      }),
    }),
    { params: Promise.resolve({ id: "1" }) },
    makeDeps(() => {
      read = true;
    }),
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: "Autoridad de stock no disponible.",
  });
  assert.equal(read, false);
});

test("liquidation fails closed on incompatible authority before reading the consignacion", async (t) => {
  t.mock.method(console, "error", () => undefined);
  let read = false;

  const response = await handlePostLiquidacionConsignacion(
    new Request("http://localhost/api/consignaciones/1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consignacionId: 1,
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
    makeDeps(() => {
      read = true;
    }),
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: "Autoridad de stock no disponible.",
  });
  assert.equal(read, false);
});
