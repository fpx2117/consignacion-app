import assert from "node:assert/strict";
import test from "node:test";
import { acquireT12IntegrationLease } from "@/app/api/t12-route-integration-lease";
import { seedVentaIntegrationFixture } from "@/app/api/ventas/route.integration-fixture";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required for T13-B");

test("only one concurrent cancellation restores stock", async (t) => {
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET ??= "t13-cancellation-integration-secret-1234567890";
  const [{ prisma }, { handleDeleteVenta }] = await Promise.all([
    import("@/lib/prisma"),
    import("./route"),
  ]);
  type Deps = NonNullable<Parameters<typeof handleDeleteVenta>[2]>;
  const releaseLease = await acquireT12IntegrationLease(databaseUrl);
  const truncate = () =>
    prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "MovimientoStock", "VentaDetalle", "Pago", "Venta", "SesionCaja",
        "Caja", "StockSucursal", "Producto", "Cliente", "Usuario",
        "Configuracion", "Sucursal", "VentaNumerador", "ConsignacionNumerador"
      RESTART IDENTITY CASCADE
    `);
  const dropFailureTrigger = () =>
    prisma.$executeRawUnsafe(`
      DROP TRIGGER IF EXISTS "t13_fail_cancellation_movement"
        ON public."MovimientoStock";
      DROP FUNCTION IF EXISTS public.t13_fail_cancellation_movement();
    `);
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
  const setMode = (mode: "APP_DUAL_WRITE" | "DB_PROJECTION") =>
    prisma.$executeRawUnsafe(
      `UPDATE public."StockAutoridad" SET "modo" = $1 WHERE "id" = 1`,
      mode,
    );
  const restoreStockAuthority = async () => {
    await dropProjection();
    await setMode("APP_DUAL_WRITE");
    await createProjection();
  };

  t.after(async () => {
    const failures: unknown[] = [];
    try {
      await dropFailureTrigger();
    } catch (error) {
      failures.push(error);
    }
    try {
      await restoreStockAuthority();
    } catch (error) {
      failures.push(error);
    }
    try {
      await truncate();
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
      throw new AggregateError(failures, "T13-B integration cleanup failed");
    }
  });

  await truncate();
  const { principal, usuario, cliente, mate } =
    await seedVentaIntegrationFixture(prisma);

  // T15-B: B1 requires APP_DUAL_WRITE with no projection trigger. Seeding ran
  // with the trigger active, so Producto is already reconciled to SUM.
  await setMode("APP_DUAL_WRITE");
  await dropProjection();
  const venta = await prisma.venta.create({
    data: {
      clienteId: cliente.id,
      sucursalId: principal.id,
      total: 20,
      detalles: {
        create: {
          productoId: mate.id,
          units: 2,
          precioUnitario: 10,
          descuento: 0,
          subtotal: 20,
        },
      },
    },
    include: { detalles: { orderBy: { id: "asc" } } },
  });
  const stockBefore = await prisma.stockSucursal.findUniqueOrThrow({
    where: {
      productoId_sucursalId: {
        productoId: mate.id,
        sucursalId: principal.id,
      },
    },
  });
  const stockSumBefore = await prisma.stockSucursal.aggregate({
    where: { productoId: mate.id },
    _sum: { stockDisponibleUnits: true },
  });

  const deps = {
    prisma: {
      $transaction: prisma.$transaction.bind(prisma),
    },
    requireAuth: async () => ({
      ok: true as const,
      user: { sub: String(usuario.id), rol: "ADMIN" as const },
      activeSucursalId: principal.id,
      allowedSucursalIds: [principal.id],
      isGlobalView: false,
      token: "test",
    }),
    isGlobalSucursalView: () => false,
    resolveTimezoneForAuth: async () => ({ tz: "America/Bogota" }),
    nowAR: () => new Date("2026-11-02T12:00:00.000Z"),
  } as unknown as Deps;
  const concurrentDeps = () => {
    let releaseTransactions!: () => void;
    const bothTransactionsReachedBarrier = new Promise<void>((resolve) => {
      releaseTransactions = resolve;
    });
    const timeout = setTimeout(() => releaseTransactions(), 5_000);
    timeout.unref();
    let transactionCount = 0;
    return {
      ...deps,
      prisma: {
        $transaction: async (
          callback: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<unknown>,
          options?: { maxWait?: number; timeout?: number; isolationLevel?: never },
        ) =>
          prisma.$transaction(async (tx) => {
            transactionCount += 1;
            if (transactionCount === 2) {
              clearTimeout(timeout);
              releaseTransactions();
            }
            await bothTransactionsReachedBarrier;
            assert.equal(
              transactionCount,
              2,
              "both cancellation transactions must overlap before the claim",
            );
            return callback(tx);
          }, options),
      },
    } as unknown as Deps;
  };
  const request = (
    saleId = venta.id,
    body: { motivo: string; brokenItems?: number[] } = {
      motivo: "T13 concurrent cancellation",
    },
  ) =>
    new Request(`http://localhost/api/ventas/${saleId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const context = (saleId = venta.id) => ({
    params: Promise.resolve({ id: String(saleId) }),
  });

  const firstConcurrentDeps = concurrentDeps();
  const responses = await Promise.all([
    handleDeleteVenta(request(), context(), firstConcurrentDeps),
    handleDeleteVenta(request(), context(), firstConcurrentDeps),
  ]);
  const statuses = responses.map((response) => response.status).sort();
  assert.deepEqual(statuses, [200, 400]);
  const loser = responses.find((response) => response.status === 400)!;
  assert.deepEqual(await loser.json(), { error: "La venta ya fue anulada" });

  const [persisted, stockAfter, movements, productAfter] = await Promise.all([
    prisma.venta.findUniqueOrThrow({ where: { id: venta.id } }),
    prisma.stockSucursal.findUniqueOrThrow({
      where: {
        productoId_sucursalId: {
          productoId: mate.id,
          sucursalId: principal.id,
        },
      },
    }),
    prisma.movimientoStock.findMany({
      where: { observaciones: { contains: `Anulación venta #${venta.id}` } },
    }),
    prisma.producto.findUniqueOrThrow({ where: { id: mate.id } }),
  ]);
  assert.equal(persisted.anulada, true);
  assert.equal(stockAfter.stockDisponibleUnits, stockBefore.stockDisponibleUnits + 2);
  assert.equal(movements.length, 1);
  assert.equal(
    productAfter.stockDisponibleUnits,
    (stockSumBefore._sum.stockDisponibleUnits ?? 0) + 2,
  );

  const brokenSale = await prisma.venta.create({
    data: {
      clienteId: cliente.id,
      sucursalId: principal.id,
      total: 10,
      detalles: {
        create: {
          productoId: mate.id,
          units: 1,
          precioUnitario: 10,
          descuento: 0,
          subtotal: 10,
        },
      },
    },
    include: { detalles: true },
  });
  const [brokenStockBefore, brokenProductBefore] = await Promise.all([
    prisma.stockSucursal.findUniqueOrThrow({
      where: {
        productoId_sucursalId: {
          productoId: mate.id,
          sucursalId: principal.id,
        },
      },
    }),
    prisma.producto.findUniqueOrThrow({ where: { id: mate.id } }),
  ]);
  const brokenBody = {
    motivo: "T13 concurrent broken cancellation",
    brokenItems: [brokenSale.detalles[0].id],
  };
  const brokenConcurrentDeps = concurrentDeps();
  const brokenResponses = await Promise.all([
    handleDeleteVenta(
      request(brokenSale.id, brokenBody),
      context(brokenSale.id),
      brokenConcurrentDeps,
    ),
    handleDeleteVenta(
      request(brokenSale.id, brokenBody),
      context(brokenSale.id),
      brokenConcurrentDeps,
    ),
  ]);
  assert.deepEqual(
    brokenResponses.map((response) => response.status).sort(),
    [200, 400],
  );
  const [brokenDetailAfter, brokenStockAfter, brokenProductAfter, brokenMovements] =
    await Promise.all([
      prisma.ventaDetalle.findUniqueOrThrow({
        where: { id: brokenSale.detalles[0].id },
      }),
      prisma.stockSucursal.findUniqueOrThrow({
        where: {
          productoId_sucursalId: {
            productoId: mate.id,
            sucursalId: principal.id,
          },
        },
      }),
      prisma.producto.findUniqueOrThrow({ where: { id: mate.id } }),
      prisma.movimientoStock.findMany({
        where: {
          observaciones: { contains: `Rotura en anulación venta #${brokenSale.id}` },
        },
      }),
    ]);
  assert.equal(brokenDetailAfter.esRotura, true);
  assert.equal(brokenStockAfter.stockDisponibleUnits, brokenStockBefore.stockDisponibleUnits);
  assert.equal(brokenProductAfter.stockDisponibleUnits, brokenProductBefore.stockDisponibleUnits);
  assert.equal(brokenMovements.length, 1);
  assert.equal(brokenMovements[0].motivo, "ROTURA");

  const alreadyCancelled = await handleDeleteVenta(request(), context(), deps);
  assert.equal(alreadyCancelled.status, 400);
  assert.deepEqual(await alreadyCancelled.json(), {
    error: "La venta ya fue anulada",
  });
  const missing = await handleDeleteVenta(
    request(),
    { params: Promise.resolve({ id: "2147483647" }) },
    deps,
  );
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: "Venta no encontrada" });

  const rollbackSale = await prisma.venta.create({
    data: {
      clienteId: cliente.id,
      sucursalId: principal.id,
      total: 20,
      detalles: {
        create: [
          {
            productoId: mate.id,
            units: 1,
            precioUnitario: 10,
            descuento: 0,
            subtotal: 10,
          },
          {
            productoId: mate.id,
            units: 1,
            precioUnitario: 10,
            descuento: 0,
            subtotal: 10,
          },
        ],
      },
    },
    include: { detalles: { orderBy: { id: "asc" } } },
  });
  const rollbackBefore = await Promise.all([
    prisma.stockSucursal.findMany({ orderBy: { id: "asc" } }),
    prisma.producto.findUniqueOrThrow({ where: { id: mate.id } }),
    prisma.movimientoStock.count(),
    prisma.ventaDetalle.findMany({
      where: { ventaId: rollbackSale.id },
      orderBy: { id: "asc" },
    }),
  ]);
  await dropFailureTrigger();
  await prisma.$executeRawUnsafe(`
    CREATE FUNCTION public.t13_fail_cancellation_movement()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.motivo = 'ROTURA'
        AND NEW.observaciones LIKE '%T13 forced rollback%' THEN
        RAISE EXCEPTION 'T13 forced rollback';
      END IF;
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER "t13_fail_cancellation_movement"
    BEFORE INSERT ON public."MovimientoStock"
    FOR EACH ROW EXECUTE FUNCTION public.t13_fail_cancellation_movement();
  `);
  let rollbackResponse: Response;
  try {
    rollbackResponse = await handleDeleteVenta(
      new Request(`http://localhost/api/ventas/${rollbackSale.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motivo: "T13 forced rollback",
          brokenItems: [rollbackSale.detalles[1].id],
        }),
      }),
      { params: Promise.resolve({ id: String(rollbackSale.id) }) },
      deps,
    );
  } finally {
    await dropFailureTrigger();
  }
  assert.equal(rollbackResponse.status, 500);
  assert.deepEqual(await rollbackResponse.json(), {
    error: "Error al anular la venta",
  });
  const rollbackAfter = await Promise.all([
    prisma.stockSucursal.findMany({ orderBy: { id: "asc" } }),
    prisma.producto.findUniqueOrThrow({ where: { id: mate.id } }),
    prisma.movimientoStock.count(),
    prisma.ventaDetalle.findMany({
      where: { ventaId: rollbackSale.id },
      orderBy: { id: "asc" },
    }),
  ]);
  assert.deepEqual(rollbackAfter, rollbackBefore);
  assert.equal(
    (await prisma.venta.findUniqueOrThrow({ where: { id: rollbackSale.id } }))
      .anulada,
    false,
  );

  // T15-B: multiple details of the same product accumulate exactly once.
  const multiSale = await prisma.venta.create({
    data: {
      clienteId: cliente.id,
      sucursalId: principal.id,
      total: 30,
      detalles: {
        create: [
          {
            productoId: mate.id,
            units: 1,
            precioUnitario: 10,
            descuento: 0,
            subtotal: 10,
          },
          {
            productoId: mate.id,
            units: 2,
            precioUnitario: 10,
            descuento: 0,
            subtotal: 20,
          },
        ],
      },
    },
  });
  const multiBefore = await Promise.all([
    prisma.movimientoStock.count(),
    prisma.stockSucursal.findUniqueOrThrow({
      where: {
        productoId_sucursalId: {
          productoId: mate.id,
          sucursalId: principal.id,
        },
      },
    }),
    prisma.producto.findUniqueOrThrow({ where: { id: mate.id } }),
  ]);
  const multiResponse = await handleDeleteVenta(
    new Request(`http://localhost/api/ventas/${multiSale.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo: "T15 multi-detail cancellation" }),
    }),
    { params: Promise.resolve({ id: String(multiSale.id) }) },
    deps,
  );
  assert.equal(multiResponse.status, 200);
  const multiAfter = await Promise.all([
    prisma.movimientoStock.count(),
    prisma.stockSucursal.findUniqueOrThrow({
      where: {
        productoId_sucursalId: {
          productoId: mate.id,
          sucursalId: principal.id,
        },
      },
    }),
    prisma.producto.findUniqueOrThrow({ where: { id: mate.id } }),
  ]);
  assert.equal(multiAfter[0], multiBefore[0] + 2);
  assert.equal(
    multiAfter[1].stockDisponibleUnits,
    multiBefore[1].stockDisponibleUnits + 3,
  );
  assert.equal(
    multiAfter[2].stockDisponibleUnits,
    multiBefore[2].stockDisponibleUnits + 3,
  );

  // T15-B: APP_DUAL_WRITE with the projection trigger active is prohibited;
  // the handler must fail closed before claiming or restoring anything.
  await createProjection();
  const mismatchSale = await prisma.venta.create({
    data: {
      clienteId: cliente.id,
      sucursalId: principal.id,
      total: 10,
      detalles: {
        create: {
          productoId: mate.id,
          units: 1,
          precioUnitario: 10,
          descuento: 0,
          subtotal: 10,
        },
      },
    },
  });
  const mismatchBefore = await Promise.all([
    prisma.movimientoStock.count(),
    prisma.stockSucursal.findUniqueOrThrow({
      where: {
        productoId_sucursalId: {
          productoId: mate.id,
          sucursalId: principal.id,
        },
      },
    }),
    prisma.producto.findUniqueOrThrow({ where: { id: mate.id } }),
  ]);
  const mismatchResponse = await handleDeleteVenta(
    new Request(`http://localhost/api/ventas/${mismatchSale.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo: "T15 incompatible authority" }),
    }),
    { params: Promise.resolve({ id: String(mismatchSale.id) }) },
    deps,
  );
  assert.equal(mismatchResponse.status, 503);
  assert.deepEqual(await mismatchResponse.json(), {
    error: "Autoridad de stock no disponible.",
  });
  const mismatchAfter = await Promise.all([
    prisma.movimientoStock.count(),
    prisma.stockSucursal.findUniqueOrThrow({
      where: {
        productoId_sucursalId: {
          productoId: mate.id,
          sucursalId: principal.id,
        },
      },
    }),
    prisma.producto.findUniqueOrThrow({ where: { id: mate.id } }),
  ]);
  assert.deepEqual(mismatchAfter, mismatchBefore);
  assert.equal(
    (await prisma.venta.findUniqueOrThrow({ where: { id: mismatchSale.id } }))
      .anulada,
    false,
  );
  await dropProjection();

  // T15-B: DB_PROJECTION writes only StockSucursal and lets the trigger
  // project Producto exactly once.
  await setMode("DB_PROJECTION");
  await createProjection();
  const projectionSale = await prisma.venta.create({
    data: {
      clienteId: cliente.id,
      sucursalId: principal.id,
      total: 20,
      detalles: {
        create: {
          productoId: mate.id,
          units: 2,
          precioUnitario: 10,
          descuento: 0,
          subtotal: 20,
        },
      },
    },
  });
  const projectionBefore = await Promise.all([
    prisma.movimientoStock.count(),
    prisma.stockSucursal.findUniqueOrThrow({
      where: {
        productoId_sucursalId: {
          productoId: mate.id,
          sucursalId: principal.id,
        },
      },
    }),
    prisma.producto.findUniqueOrThrow({ where: { id: mate.id } }),
  ]);
  const projectionResponse = await handleDeleteVenta(
    new Request(`http://localhost/api/ventas/${projectionSale.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo: "T15 projected cancellation" }),
    }),
    { params: Promise.resolve({ id: String(projectionSale.id) }) },
    deps,
  );
  assert.equal(projectionResponse.status, 200);
  const projectionAfter = await Promise.all([
    prisma.movimientoStock.count(),
    prisma.stockSucursal.findUniqueOrThrow({
      where: {
        productoId_sucursalId: {
          productoId: mate.id,
          sucursalId: principal.id,
        },
      },
    }),
    prisma.producto.findUniqueOrThrow({ where: { id: mate.id } }),
  ]);
  assert.equal(projectionAfter[0], projectionBefore[0] + 1);
  assert.equal(
    projectionAfter[1].stockDisponibleUnits,
    projectionBefore[1].stockDisponibleUnits + 2,
  );
  assert.equal(
    projectionAfter[2].stockDisponibleUnits,
    projectionBefore[2].stockDisponibleUnits + 2,
  );
  assert.equal(
    (
      await prisma.venta.findUniqueOrThrow({
        where: { id: projectionSale.id },
      })
    ).anulada,
    true,
  );
});
