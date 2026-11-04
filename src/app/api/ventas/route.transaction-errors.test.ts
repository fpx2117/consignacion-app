import assert from "node:assert/strict";
import test, { before } from "node:test";

type Handler = typeof import("@/app/api/ventas/route").handlePostVenta;
type Deps = NonNullable<Parameters<Handler>[1]>;
type Failure = "missing" | "insufficient" | "post-missing" | "unexpected" | "retry";

let handlePostVenta: Handler;
let makeRetriableError: () => Error;

before(async () => {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:1/test";
  process.env.JWT_SECRET ??= "t09-characterization-only-secret-1234567890";
  const [route, client] = await Promise.all([
    import("@/app/api/ventas/route"),
    import("@prisma/client"),
  ]);
  handlePostVenta = route.handlePostVenta;
  makeRetriableError = () =>
    new client.Prisma.PrismaClientKnownRequestError("serialization conflict", {
      code: "P2034",
      clientVersion: client.Prisma.prismaVersion.client,
    });
});

function request() {
  return new Request("http://localhost/api/ventas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: [{ productoId: 11, units: 2 }] }),
  });
}

const PRODUCT = {
  id: 11,
  nombre: "Mate",
  stockDisponibleUnits: 6,
  stockMinUnits: 0,
};

/**
 * El fake cubre las dos formas de acceso: el handler legacy lee
 * `findUnique + select` y el caso de uso usa la transición compartida, que
 * relee con `findUniqueOrThrow`.
 */
function makeHarness(failure: Failure) {
  let attempts = 0;
  const tx = {
    $queryRaw: async () => [{ modo: "APP_DUAL_WRITE", projection: 0 }],
    $executeRaw: async () => undefined,
    cliente: {
      findFirst: async () => ({ id: 22 }),
    },
    producto: {
      update: async () => PRODUCT,
      findUniqueOrThrow: async () => PRODUCT,
    },
    stockSucursal: {
      findUnique: async (args: { include?: unknown; select?: unknown }) => {
        if (failure === "missing" && args.include) return null;
        if (failure === "post-missing" && args.select) return null;
        return {
          producto: {
            id: 11,
            nombre: "Mate",
            precioVenta: "10.01",
            descuentoActivo: false,
            tipoDescuento: "porcentaje",
            descuentoPorcentaje: null,
            descuentoMonto: null,
            descuentoDesde: null,
            descuentoHasta: null,
          },
          precioVentaOverride: null,
          stockDisponibleUnits: args.select ? 6 : 8,
        };
      },
      findUniqueOrThrow: async () => {
        if (failure === "post-missing") {
          throw new Error("No se pudo confirmar stock");
        }
        return { stockDisponibleUnits: 6 };
      },
      updateMany: async () => ({ count: failure === "insufficient" ? 0 : 1 }),
    },
    movimientoStock: { create: async () => ({}) },
    venta: { findFirst: async () => null },
  };
  const deps = {
    requireAuth: async () => ({
      ok: true as const,
      user: {
        sub: "7",
        rol: "ADMIN" as const,
        email: "admin@example.com",
        nombre: "Admin",
        sucursalId: 3,
      },
      activeSucursalId: 3,
      allowedSucursalIds: [3],
      isGlobalView: false,
      token: "token",
    }),
    isGlobalSucursalView: () => false,
    obtenerConfiguracionGlobal: async () => ({
      usarControlDeCaja: true,
      notificarVentas: false,
      porcentajeInteresTarjeta: 0,
    }),
    resolveTimezoneForAuth: async () => ({ tz: "America/Bogota" }),
    nowAR: () => new Date("2026-02-01T01:00:00.000Z"),
    prisma: {
      sesionCaja: { findFirst: async () => ({ id: 15 }) },
      cliente: {
        findFirst: async () => ({ id: 22 }),
        create: async () => ({ id: 22 }),
      },
      $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => {
        attempts += 1;
        if (failure === "unexpected") throw new Error("internal detail");
        if (failure === "retry") throw makeRetriableError();
        return callback(tx);
      },
    },
    evaluateStockAlert: () => null,
    processNotificationQueue: async () => undefined,
    sendNotification: async () => undefined,
  } as unknown as Deps;
  return { deps, attempts: () => attempts };
}

test("caracteriza fallos transaccionales de POST /api/ventas en ambos dispatches", async (t) => {
  t.mock.method(console, "error", () => undefined);

  for (const useCase of ["legacy", "application"] as const) {
    await t.test(`dispatch ${useCase}`, async (dispatch) => {
      dispatch.after(() => {
        delete process.env.SALES_REGISTER_USE_CASE;
      });
      process.env.SALES_REGISTER_USE_CASE = useCase;

      await dispatch.test("producto sin asignación devuelve 409", async () => {
        const { deps } = makeHarness("missing");
        const response = await handlePostVenta(request(), deps);
        assert.equal(response.status, 409);
        assert.deepEqual(await response.json(), {
          error: "El producto #11 no está asignado a esta sucursal.",
        });
      });

      await dispatch.test("stock insuficiente devuelve 409", async () => {
        const { deps } = makeHarness("insufficient");
        const response = await handlePostVenta(request(), deps);
        assert.equal(response.status, 409);
        assert.deepEqual(await response.json(), {
          error: 'Stock insuficiente para "Mate".',
        });
      });

      await dispatch.test("stock ausente después del decremento se sanitiza", async () => {
        const { deps } = makeHarness("post-missing");
        const response = await handlePostVenta(request(), deps);
        assert.equal(response.status, 500);
        assert.deepEqual(await response.json(), {
          error: "Error al procesar la venta",
        });
      });

      await dispatch.test("un error inesperado se sanitiza", async () => {
        const { deps } = makeHarness("unexpected");
        const response = await handlePostVenta(request(), deps);
        assert.equal(response.status, 500);
        assert.deepEqual(await response.json(), {
          error: "Error al procesar la venta",
        });
      });

      await dispatch.test("un conflicto P2034 agota tres intentos", async () => {
        const { deps, attempts } = makeHarness("retry");
        const response = await handlePostVenta(request(), deps);
        assert.equal(response.status, 500);
        assert.equal(attempts(), 3);
        assert.deepEqual(await response.json(), {
          error: "Error al procesar la venta",
        });
      });
    });
  }
});
