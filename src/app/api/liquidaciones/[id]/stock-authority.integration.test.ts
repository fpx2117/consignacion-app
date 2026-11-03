import assert from "node:assert/strict";
import test from "node:test";
import { acquireT12IntegrationLease } from "@/app/api/t12-route-integration-lease";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("TEST_DATABASE_URL is required for T15-E PUT");
}

const truncateSql = `
  TRUNCATE TABLE
    "MovimientoStock", "VentaDetalle", "Pago", "Venta", "LiquidacionItem",
    "Liquidacion", "ConsignacionDetalle", "Consignacion", "SesionCaja",
    "Caja", "StockSucursal", "Producto", "Cliente", "Usuario", "Sucursal",
    "VentaNumerador", "ConsignacionNumerador"
  RESTART IDENTITY CASCADE
`;

test("liquidation correction obeys the B1 stock authority", async (t) => {
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET ??= "t15e-put-secret-1234567890";
  const [{ prisma }, { handlePutLiquidacion }] = await Promise.all([
    import("@/lib/prisma"),
    import("./route"),
  ]);
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
      throw new AggregateError(failures, "T15-E PUT cleanup failed");
    }
  });

  await prisma.$executeRawUnsafe(truncateSql);
  const sucursal = await prisma.sucursal.create({
    data: { nombre: "T15-E PUT Sucursal", esPrincipal: true },
  });
  const cliente = await prisma.cliente.create({
    data: { nombre: "T15-E PUT Cliente", sucursalId: sucursal.id },
  });
  const producto = await prisma.producto.create({
    data: {
      nombre: "T15-E PUT Producto",
      precioVenta: "100.00",
      precioCosto: "50.00",
      sucursalId: sucursal.id,
    },
  });
  await prisma.stockSucursal.create({
    data: {
      productoId: producto.id,
      sucursalId: sucursal.id,
      stockDisponibleUnits: 10,
      stockConsignadoUnits: 10,
    },
  });
  const consignacion = await prisma.consignacion.create({
    data: {
      clienteId: cliente.id,
      sucursalId: sucursal.id,
      numeroFolio: 1,
      detalles: {
        create: {
          productoId: producto.id,
          unitsEntregadas: 10,
          unitsVendidasAcum: 2,
          unitsDevueltasAcum: 1,
          precioUnitario: 100,
          descuento: 0,
        },
      },
    },
    include: { detalles: { orderBy: { id: "asc" } } },
  });
  await prisma.stockSucursal.update({
    where: {
      productoId_sucursalId: {
        productoId: producto.id,
        sucursalId: sucursal.id,
      },
    },
    data: { stockDisponibleUnits: 11, stockConsignadoUnits: 7 },
  });
  const liquidacion = await prisma.liquidacion.create({
    data: {
      consignacionId: consignacion.id,
      items: {
        create: {
          consignacionDetalleId: consignacion.detalles[0].id,
          unitsVendidas: 2,
          unitsDevueltas: 1,
          precioUnitario: 100,
        },
      },
    },
  });
  await prisma.venta.create({
    data: {
      clienteId: cliente.id,
      sucursalId: sucursal.id,
      liquidacionId: liquidacion.id,
      total: 200,
      tipo: "LIQUIDACION",
    },
  });
  await prisma.cliente.update({
    where: { id: cliente.id },
    data: { saldoCuenta: 200 },
  });

  const deps = {
    prisma,
    requireAuth: async () => ({
      ok: true as const,
      user: { sub: "1", rol: "ADMIN" as const },
      token: "t15e-token",
      activeSucursalId: sucursal.id,
      allowedSucursalIds: [sucursal.id],
      isGlobalView: false,
    }),
    isGlobalSucursalView: () => false,
    obtenerConfiguracionGlobal: async () => ({ notificarVentas: false }),
    evaluateStockAlert: () => null,
    processNotificationQueue: async () => undefined,
  } as unknown as NonNullable<Parameters<typeof handlePutLiquidacion>[2]>;

  const request = (unitsVendidas: number, unitsDevueltas: number) =>
    new Request(`http://localhost/api/liquidaciones/${liquidacion.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            consignacionDetalleId: consignacion.detalles[0].id,
            unitsVendidas,
            unitsDevueltas,
          },
        ],
      }),
    });
  const context = { params: Promise.resolve({ id: String(liquidacion.id) }) };
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
      prisma.consignacionDetalle.findUniqueOrThrow({
        where: { id: consignacion.detalles[0].id },
      }),
      prisma.movimientoStock.count(),
    ]);

  // DUAL_WRITE: reverse the old liquidation and apply the new one.
  await setMode("APP_DUAL_WRITE");
  await dropProjection();
  const dualResponse = await handlePutLiquidacion(
    request(1, 1),
    context,
    deps,
  );
  assert.equal(dualResponse.status, 200);
  const dualState = await state();
  assert.equal(dualState[0].stockDisponibleUnits, 11);
  assert.equal(dualState[0].stockConsignadoUnits, 8);
  assert.equal(dualState[1].stockDisponibleUnits, 11);
  assert.equal(dualState[1].stockConsignadoUnits, 8);
  assert.equal(dualState[2].unitsVendidasAcum, 1);
  assert.equal(dualState[2].unitsDevueltasAcum, 1);
  assert.equal(dualState[3], 4);
  const dualMovements = await prisma.movimientoStock.findMany({
    orderBy: { id: "asc" },
  });
  assert.deepEqual(
    dualMovements.map((movement) => [
      movement.tipo,
      movement.motivo,
      movement.cantidad,
      movement.stockPrevio,
      movement.stockPosterior,
    ]),
    [
      ["SALIDA", "AJUSTE_NEGATIVO", 1, 11, 10],
      ["ENTRADA", "AJUSTE_POSITIVO", 2, 11, 10],
      ["ENTRADA", "DEVOLUCION_CLIENTE", 1, 10, 11],
      ["SALIDA", "VENTA", 1, 10, 11],
    ],
  );
  const [newItem, newVenta, updatedClient] = await Promise.all([
    prisma.liquidacionItem.findFirstOrThrow({
      where: { liquidacionId: liquidacion.id },
    }),
    prisma.venta.findFirstOrThrow(),
    prisma.cliente.findUniqueOrThrow({ where: { id: cliente.id } }),
  ]);
  assert.equal(newItem.unitsVendidas, 1);
  assert.equal(newItem.unitsDevueltas, 1);
  assert.equal(newVenta.total.toString(), "100");
  assert.equal(updatedClient.saldoCuenta.toString(), "100");

  // DB_PROJECTION: reverse (1,1) and apply (1,0) exactly once.
  await setMode("DB_PROJECTION");
  await createProjection();
  const projectionResponse = await handlePutLiquidacion(
    request(1, 0),
    context,
    deps,
  );
  assert.equal(projectionResponse.status, 200);
  const projectionState = await state();
  assert.equal(projectionState[0].stockDisponibleUnits, 10);
  assert.equal(projectionState[0].stockConsignadoUnits, 9);
  assert.equal(projectionState[1].stockDisponibleUnits, 10);
  assert.equal(projectionState[1].stockConsignadoUnits, 9);
  assert.equal(projectionState[2].unitsVendidasAcum, 1);
  assert.equal(projectionState[2].unitsDevueltasAcum, 0);
  assert.equal(projectionState[3], 7);
  const projectionMovements = await prisma.movimientoStock.findMany({
    orderBy: { id: "asc" },
  });
  assert.deepEqual(
    projectionMovements.slice(4).map((movement) => [
      movement.tipo,
      movement.motivo,
      movement.cantidad,
      movement.stockPrevio,
      movement.stockPosterior,
    ]),
    [
      ["SALIDA", "AJUSTE_NEGATIVO", 1, 11, 10],
      ["ENTRADA", "AJUSTE_POSITIVO", 1, 11, 10],
      ["SALIDA", "VENTA", 1, 10, 10],
    ],
  );

  // Incompatible state: fail closed before touching anything.
  await setMode("APP_DUAL_WRITE");
  const beforeMismatch = await Promise.all([
    state(),
    prisma.liquidacionItem.findFirstOrThrow({
      where: { liquidacionId: liquidacion.id },
    }),
    prisma.venta.findFirstOrThrow(),
    prisma.cliente.findUniqueOrThrow({ where: { id: cliente.id } }),
  ]);
  const rejected = await handlePutLiquidacion(request(1, 1), context, deps);
  assert.equal(rejected.status, 503);
  assert.deepEqual(await rejected.json(), {
    error: "Autoridad de stock no disponible.",
  });
  const afterMismatch = await Promise.all([
    state(),
    prisma.liquidacionItem.findFirstOrThrow({
      where: { liquidacionId: liquidacion.id },
    }),
    prisma.venta.findFirstOrThrow(),
    prisma.cliente.findUniqueOrThrow({ where: { id: cliente.id } }),
  ]);
  assert.deepEqual(afterMismatch, beforeMismatch);
});
