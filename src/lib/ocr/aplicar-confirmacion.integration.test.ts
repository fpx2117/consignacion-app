import assert from "node:assert/strict";
import test from "node:test";
import { acquireT12IntegrationLease } from "@/app/api/t12-route-integration-lease";
import { aplicarMovimientoStock } from "./aplicar-confirmacion";
import { StockAuthorityError } from "@/modules/inventory/stock-authority";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("TEST_DATABASE_URL is required for T15-G");
}

const truncateSql = `
  TRUNCATE TABLE
    "MovimientoStock", "VentaDetalle", "Pago", "Venta", "LiquidacionItem",
    "Liquidacion", "ConsignacionDetalle", "Consignacion", "PedidoEsperadoItem",
    "PedidoEsperado", "StockSucursal", "Producto", "Cliente", "SesionCaja",
    "Caja", "Usuario", "Sucursal", "VentaNumerador", "ConsignacionNumerador"
  RESTART IDENTITY CASCADE
`;

test("OCR stock application obeys the B1 authority", async (t) => {
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
      throw new AggregateError(failures, "T15-G cleanup failed");
    }
  });

  await prisma.$executeRawUnsafe(truncateSql);
  const sucursal = await prisma.sucursal.create({
    data: { nombre: "T15-G Sucursal", esPrincipal: true },
  });
  const producto = await prisma.producto.create({
    data: {
      nombre: "T15-G Producto",
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

  const apply = (cantidad: number) =>
    prisma.$transaction((tx) =>
      aplicarMovimientoStock(tx, {
        productoId: producto.id,
        sucursalId: sucursal.id,
        cantidad,
        observaciones: "T15-G test",
      }),
    );
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
      prisma.movimientoStock.count({ where: { productoId: producto.id } }),
    ]);

  // A) APP_DUAL_WRITE.
  await setMode("APP_DUAL_WRITE");
  await dropProjection();
  await apply(2);
  const dual = await state();
  assert.equal(dual[0].stockDisponibleUnits, 7);
  assert.equal(dual[1].stockDisponibleUnits, 7);
  assert.equal(dual[2], 1);
  const dualMovement = await prisma.movimientoStock.findFirstOrThrow({
    where: { productoId: producto.id },
    orderBy: { id: "desc" },
  });
  assert.equal(dualMovement.stockPrevio, 5);
  assert.equal(dualMovement.stockPosterior, 7);

  // B) DB_PROJECTION.
  await setMode("DB_PROJECTION");
  await createProjection();
  await apply(2);
  const projection = await state();
  assert.equal(projection[0].stockDisponibleUnits, 9);
  assert.equal(projection[1].stockDisponibleUnits, 9);
  assert.equal(projection[2], 2);

  // C) Incompatible state fails before stock mutation.
  await setMode("APP_DUAL_WRITE");
  const beforeMismatch = await state();
  await assert.rejects(
    apply(1),
    (error: unknown) =>
      error instanceof StockAuthorityError &&
      error.code === "STOCK_AUTHORITY_INCOMPATIBLE",
  );
  assert.deepEqual(await state(), beforeMismatch);

  // D) Concurrent applications increment exactly once each.
  await setMode("APP_DUAL_WRITE");
  await dropProjection();
  await Promise.all([apply(1), apply(1)]);
  const concurrent = await state();
  assert.equal(concurrent[0].stockDisponibleUnits, 11);
  assert.equal(concurrent[1].stockDisponibleUnits, 11);
  assert.equal(concurrent[2], 4);
  const concurrentMovements = await prisma.movimientoStock.findMany({
    where: { productoId: producto.id },
    orderBy: { id: "asc" },
  });
  assert.deepEqual(
    concurrentMovements
      .slice(-2)
      .map((movement) => [movement.stockPrevio, movement.stockPosterior])
      .sort((a, b) => a[0] - b[0]),
    [
      [9, 10],
      [10, 11],
    ],
  );
});
