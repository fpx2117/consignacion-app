import assert from "node:assert/strict";
import test from "node:test";
import { acquireT12IntegrationLease } from "@/app/api/t12-route-integration-lease";
import {
  decrementBranchStock,
  incrementBranchStock,
  lockStockAuthority,
} from "./stock-authority";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("TEST_DATABASE_URL is required for T15-H");
}

const truncateSql = `
  TRUNCATE TABLE
    "MovimientoStock", "VentaDetalle", "Pago", "Venta", "LiquidacionItem",
    "Liquidacion", "ConsignacionDetalle", "Consignacion", "PedidoEsperadoItem",
    "PedidoEsperado", "StockSucursal", "Producto", "Cliente", "SesionCaja",
    "Caja", "Usuario", "Sucursal", "VentaNumerador", "ConsignacionNumerador"
  RESTART IDENTITY CASCADE
`;

test("branch stock transitions obey the B1 authority", async (t) => {
  process.env.DATABASE_URL = databaseUrl;
  const { prisma } = await import("@/lib/prisma");
  const releaseLease = await acquireT12IntegrationLease(databaseUrl);

  const setMode = (mode: "APP_DUAL_WRITE" | "DB_PROJECTION") =>
    prisma.$executeRawUnsafe(
      `UPDATE public."StockAutoridad" SET "modo" = $1 WHERE "id" = 1`,
      mode,
    );
  const dropProjection = () =>
    prisma.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS "trg_sync_producto_stock" ON public."StockSucursal"`,
    );
  const createProjection = () =>
    prisma.$executeRawUnsafe(`
      CREATE TRIGGER "trg_sync_producto_stock"
      AFTER INSERT OR UPDATE OR DELETE ON public."StockSucursal"
      FOR EACH ROW EXECUTE FUNCTION public.sync_producto_stock()
    `);
  const restoreStockAuthority = async () => {
    await dropProjection();
    await setMode("APP_DUAL_WRITE");
    await createProjection();
  };

  t.after(async () => {
    const failures: unknown[] = [];
    try {
      await restoreStockAuthority();
    } catch (error) {
      failures.push(error);
    }
    try {
      await prisma.$executeRawUnsafe(truncateSql);
    } catch (error) {
      failures.push(error);
    }
    try {
      await prisma.$disconnect();
    } catch (error) {
      failures.push(error);
    }
    try {
      await releaseLease();
    } catch (error) {
      failures.push(error);
    }
    if (failures.length) {
      throw new AggregateError(failures, "T15-H cleanup failed");
    }
  });

  await prisma.$executeRawUnsafe(truncateSql);
  const sucursal = await prisma.sucursal.create({
    data: { nombre: "T15-H Sucursal", esPrincipal: true },
  });
  const producto = await prisma.producto.create({
    data: {
      nombre: "T15-H Producto",
      precioVenta: 100,
      precioCosto: 50,
      sucursalId: sucursal.id,
      stockDisponibleUnits: 5,
    },
  });
  await prisma.stockSucursal.create({
    data: {
      productoId: producto.id,
      sucursalId: sucursal.id,
      stockDisponibleUnits: 5,
    },
  });

  const state = () =>
    Promise.all([
      prisma.stockSucursal.findUniqueOrThrow({
        where: {
          productoId_sucursalId: {
            productoId: producto.id,
            sucursalId: sucursal.id,
          },
        },
      }),
      prisma.producto.findUniqueOrThrow({ where: { id: producto.id } }),
    ]);

  const increment = (units: number) =>
    prisma.$transaction(async (tx) => {
      const authority = await lockStockAuthority(tx);
      return incrementBranchStock(tx, authority, {
        productoId: producto.id,
        sucursalId: sucursal.id,
        units,
      });
    });
  const decrement = (units: number) =>
    prisma.$transaction(async (tx) => {
      const authority = await lockStockAuthority(tx);
      return decrementBranchStock(tx, authority, {
        productoId: producto.id,
        sucursalId: sucursal.id,
        units,
      });
    });

  // A) DUAL_WRITE increment/decrement.
  await setMode("APP_DUAL_WRITE");
  await dropProjection();
  assert.deepEqual(await increment(2), { prev: 5, post: 7 });
  const afterIncrement = await state();
  assert.equal(afterIncrement[0].stockDisponibleUnits, 7);
  assert.equal(afterIncrement[1].stockDisponibleUnits, 7);

  assert.deepEqual(await decrement(3), { prev: 7, post: 4 });
  const afterDecrement = await state();
  assert.equal(afterDecrement[0].stockDisponibleUnits, 4);
  assert.equal(afterDecrement[1].stockDisponibleUnits, 4);

  // B) Insufficient decrement changes nothing.
  assert.equal(await decrement(99), null);
  assert.deepEqual(await state(), afterDecrement);

  // C) DB_PROJECTION increment/decrement.
  await setMode("DB_PROJECTION");
  await createProjection();
  assert.deepEqual(await increment(2), { prev: 4, post: 6 });
  assert.deepEqual(await decrement(1), { prev: 6, post: 5 });
  const projected = await state();
  assert.equal(projected[0].stockDisponibleUnits, 5);
  assert.equal(projected[1].stockDisponibleUnits, 5);

  // D) Concurrent transitions apply exactly once each.
  await setMode("APP_DUAL_WRITE");
  await dropProjection();
  await Promise.all([increment(1), increment(1)]);
  const concurrentIncrement = await state();
  assert.equal(concurrentIncrement[0].stockDisponibleUnits, 7);
  assert.equal(concurrentIncrement[1].stockDisponibleUnits, 7);
  await Promise.all([decrement(1), decrement(1)]);
  const concurrentDecrement = await state();
  assert.equal(concurrentDecrement[0].stockDisponibleUnits, 5);
  assert.equal(concurrentDecrement[1].stockDisponibleUnits, 5);
});
