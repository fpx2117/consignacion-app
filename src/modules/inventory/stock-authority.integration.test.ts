import assert from "node:assert/strict";
import test from "node:test";
import { acquireT12IntegrationLease } from "@/app/api/t12-route-integration-lease";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("TEST_DATABASE_URL is required for the stock authority test");
}

const truncateSql = `
  TRUNCATE TABLE
    "MovimientoStock", "VentaDetalle", "Pago", "Venta", "SesionCaja",
    "Caja", "StockSucursal", "Producto", "Cliente", "Usuario",
    "Configuracion", "Sucursal", "VentaNumerador", "ConsignacionNumerador"
  RESTART IDENTITY CASCADE
`;

test("B1 stock authority keeps the global projection invariant", async (t) => {
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET ??= "t15-stock-authority-secret-1234567890";
  const [{ prisma }, authorityModule] = await Promise.all([
    import("@/lib/prisma"),
    import("./stock-authority"),
  ]);
  const {
    applyProductoGlobalDelta,
    lockStockAuthority,
    StockAuthorityError,
  } = authorityModule;
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

  t.after(async () => {
    const failures: unknown[] = [];
    try {
      await dropProjection();
    } catch (error) {
      failures.push(error);
    }
    try {
      await setMode("APP_DUAL_WRITE");
    } catch (error) {
      failures.push(error);
    }
    try {
      await createProjection();
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
      throw new AggregateError(failures, "Stock authority cleanup failed");
    }
  });

  await prisma.$executeRawUnsafe(truncateSql);
  const sucursalA = await prisma.sucursal.create({
    data: { nombre: "B1 A", esPrincipal: true },
  });
  const sucursalB = await prisma.sucursal.create({
    data: { nombre: "B1 B" },
  });
  const producto = await prisma.producto.create({
    data: {
      nombre: "B1 Producto",
      precioVenta: "10.00",
      precioCosto: "5.00",
      stockDisponibleUnits: 20,
      sucursalId: sucursalA.id,
    },
  });
  await prisma.stockSucursal.createMany({
    data: [
      {
        productoId: producto.id,
        sucursalId: sucursalA.id,
        stockDisponibleUnits: 10,
      },
      {
        productoId: producto.id,
        sucursalId: sucursalB.id,
        stockDisponibleUnits: 10,
      },
    ],
  });
  await dropProjection();

  await t.test("rejects every incompatible capability/projection pair", async () => {
    const readMode = () =>
      prisma.$transaction((tx) => lockStockAuthority(tx));

    assert.equal((await readMode()).mode, "APP_DUAL_WRITE");

    await createProjection();
    await assert.rejects(
      readMode(),
      (error: unknown) =>
        error instanceof StockAuthorityError &&
        error.code === "STOCK_AUTHORITY_INCOMPATIBLE",
    );

    await setMode("DB_PROJECTION");
    assert.equal((await readMode()).mode, "DB_PROJECTION");

    await dropProjection();
    await assert.rejects(
      readMode(),
      (error: unknown) =>
        error instanceof StockAuthorityError &&
        error.code === "STOCK_AUTHORITY_INCOMPATIBLE",
    );

    await setMode("APP_DUAL_WRITE");

    let missing: unknown;
    await assert.rejects(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DELETE FROM public."StockAutoridad" WHERE "id" = 1`,
        );
        try {
          await lockStockAuthority(tx);
        } catch (error) {
          missing = error;
        }
        throw new Error("rollback-marker");
      }),
      /rollback-marker/,
    );
    assert.ok(missing instanceof StockAuthorityError);
    assert.equal(missing.code, "STOCK_AUTHORITY_MISSING");
  });

  await t.test("concurrent dual-write deltas do not lose global updates", async () => {
    let arrived = 0;
    let releaseBarrier!: () => void;
    const bothArrived = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });
    const timeout = setTimeout(() => releaseBarrier(), 5_000);
    timeout.unref();
    const waitForBoth = async () => {
      arrived += 1;
      if (arrived === 2) {
        clearTimeout(timeout);
        releaseBarrier();
      }
      await bothArrived;
      assert.equal(
        arrived,
        2,
        "both B1 transactions must overlap after their stock update",
      );
    };

    const decrement = (sucursalId: number, units: number) =>
      prisma.$transaction(async (tx) => {
        const authority = await lockStockAuthority(tx);
        const updated = await tx.stockSucursal.updateMany({
          where: {
            productoId: producto.id,
            sucursalId,
            stockDisponibleUnits: { gte: units },
          },
          data: { stockDisponibleUnits: { decrement: units } },
        });
        assert.equal(updated.count, 1);
        await waitForBoth();
        await applyProductoGlobalDelta(tx, authority, {
          productoId: producto.id,
          disponibleDelta: -units,
          consignadoDelta: 0,
        });
      });

    await Promise.all([
      decrement(sucursalA.id, 3),
      decrement(sucursalB.id, 4),
    ]);

    const [stocks, projected] = await Promise.all([
      prisma.stockSucursal.findMany({
        where: { productoId: producto.id },
        orderBy: { sucursalId: "asc" },
      }),
      prisma.producto.findUniqueOrThrow({ where: { id: producto.id } }),
    ]);
    assert.deepEqual(
      stocks.map((stock) => stock.stockDisponibleUnits),
      [7, 6],
    );
    assert.equal(projected.stockDisponibleUnits, 13);
  });

  await t.test("projection mode writes only StockSucursal", async () => {
    await setMode("DB_PROJECTION");
    await createProjection();

    await prisma.$transaction(async (tx) => {
      const authority = await lockStockAuthority(tx);
      assert.equal(authority.mode, "DB_PROJECTION");
      await tx.stockSucursal.update({
        where: {
          productoId_sucursalId: {
            productoId: producto.id,
            sucursalId: sucursalA.id,
          },
        },
        data: { stockDisponibleUnits: { decrement: 2 } },
      });
      const projected = await applyProductoGlobalDelta(tx, authority, {
        productoId: producto.id,
        disponibleDelta: -2,
        consignadoDelta: 0,
      });
      assert.equal(projected.stockDisponibleUnits, 11);
    });

    const [stockA, projected] = await Promise.all([
      prisma.stockSucursal.findUniqueOrThrow({
        where: {
          productoId_sucursalId: {
            productoId: producto.id,
            sucursalId: sucursalA.id,
          },
        },
      }),
      prisma.producto.findUniqueOrThrow({ where: { id: producto.id } }),
    ]);
    assert.equal(stockA.stockDisponibleUnits, 5);
    assert.equal(projected.stockDisponibleUnits, 11);
  });
});
