import assert from "node:assert/strict";
import test from "node:test";
import {
  applyProductoGlobalDelta,
  calculateStockTransition,
  lockStockAuthority,
  StockAuthorityError,
} from "./stock-authority";

type AuthorityRows = Array<{ modo: string; projection: number }>;

function readAuthority(rows: AuthorityRows) {
  return lockStockAuthority({ $queryRaw: async () => rows } as never);
}

test("fails closed on every missing or incompatible authority state", async () => {
  await assert.rejects(readAuthority([]), (error: unknown) => {
    return (
      error instanceof StockAuthorityError &&
      error.code === "STOCK_AUTHORITY_MISSING"
    );
  });
  await assert.rejects(
    readAuthority([{ modo: "UNKNOWN", projection: 0 }]),
    (error: unknown) => {
      return (
        error instanceof StockAuthorityError &&
        error.code === "STOCK_AUTHORITY_UNKNOWN"
      );
    },
  );
  await assert.rejects(
    readAuthority([{ modo: "APP_DUAL_WRITE", projection: 1 }]),
    (error: unknown) => {
      return (
        error instanceof StockAuthorityError &&
        error.code === "STOCK_AUTHORITY_INCOMPATIBLE"
      );
    },
  );
  await assert.rejects(
    readAuthority([{ modo: "DB_PROJECTION", projection: 0 }]),
    (error: unknown) => {
      return (
        error instanceof StockAuthorityError &&
        error.code === "STOCK_AUTHORITY_INCOMPATIBLE"
      );
    },
  );

  assert.equal(
    (await readAuthority([{ modo: "APP_DUAL_WRITE", projection: 0 }])).mode,
    "APP_DUAL_WRITE",
  );
  assert.equal(
    (await readAuthority([{ modo: "DB_PROJECTION", projection: 1 }])).mode,
    "DB_PROJECTION",
  );
});

test("dual-write applies an atomic delta and never recomputes the sum", async () => {
  const updates: unknown[] = [];
  const client = {
    stockSucursal: {
      aggregate: async () => {
        throw new Error("dual-write must not aggregate StockSucursal");
      },
      findMany: async () => {
        throw new Error("dual-write must not list StockSucursal");
      },
    },
    producto: {
      update: async (args: unknown) => {
        updates.push(args);
        return { id: 1, stockDisponibleUnits: 7 };
      },
    },
  };

  await applyProductoGlobalDelta(
    client as never,
    { mode: "APP_DUAL_WRITE", projection: false },
    { productoId: 1, disponibleDelta: -3, consignadoDelta: 0 },
  );

  assert.deepEqual(updates, [
    {
      where: { id: 1 },
      data: {
        stockDisponibleUnits: { increment: -3 },
        stockConsignadoUnits: { increment: 0 },
      },
    },
  ]);
});

test("projection mode reads the projected row without updating Producto", async () => {
  let updated = false;
  const client = {
    stockSucursal: {
      aggregate: async () => {
        throw new Error("projection mode must not aggregate StockSucursal");
      },
    },
    producto: {
      findUniqueOrThrow: async (args: { where: { id: number } }) => ({
        id: args.where.id,
        stockDisponibleUnits: 5,
      }),
      update: async () => {
        updated = true;
        return { id: 1, stockDisponibleUnits: 1 };
      },
    },
  };

  const projected = await applyProductoGlobalDelta(
    client as never,
    { mode: "DB_PROJECTION", projection: true },
    { productoId: 7, disponibleDelta: -2, consignadoDelta: 0 },
  );

  assert.equal(projected.stockDisponibleUnits, 5);
  assert.equal(updated, false);
});

test("la transición de stock deriva el previo del post-image persistido", () => {
  assert.deepEqual(calculateStockTransition(8, 2), { prev: 6, post: 8 });
  assert.deepEqual(calculateStockTransition(8, -2), { prev: 10, post: 8 });
  assert.deepEqual(calculateStockTransition(0, 5), { prev: -5, post: 0 });
  // Sin recorte: un estado inconsistente se ve tal cual.
  assert.deepEqual(calculateStockTransition(-2, 1), { prev: -3, post: -2 });
  // Se preserva la coma flotante exacta del cálculo original.
  const flotante = calculateStockTransition(0.3, 0.1);
  assert.ok(Object.is(flotante.prev, 0.3 - 0.1));
  assert.ok(Object.is(flotante.post, 0.3));
});
test("la transición de stock conserva la coma flotante exacta", () => {
  const flotante = calculateStockTransition(0.3, 0.1);
  assert.equal(flotante.post, 0.3);
  assert.equal(flotante.prev, 0.19999999999999998);
  const negativa = calculateStockTransition(0.3, -0.1);
  assert.equal(negativa.prev, 0.4);
});
