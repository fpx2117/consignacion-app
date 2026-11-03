import assert from "node:assert/strict";
import test from "node:test";
import { acquireT12IntegrationLease } from "@/app/api/t12-route-integration-lease";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("TEST_DATABASE_URL is required for T15-E POST");
}

const truncateSql = `
  TRUNCATE TABLE
    "MovimientoStock", "VentaDetalle", "Pago", "Venta", "LiquidacionItem",
    "Liquidacion", "ConsignacionDetalle", "Consignacion", "SesionCaja",
    "Caja", "StockSucursal", "Producto", "Cliente", "Usuario", "Sucursal",
    "VentaNumerador", "ConsignacionNumerador"
  RESTART IDENTITY CASCADE
`;

test("liquidation by consignacion obeys the B1 stock authority", async (t) => {
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET ??= "t15e-post-secret-1234567890";
  const [{ prisma }, { handlePostLiquidacionByConsignacion }] =
    await Promise.all([import("@/lib/prisma"), import("./route")]);
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
      throw new AggregateError(failures, "T15-E POST cleanup failed");
    }
  });

  await prisma.$executeRawUnsafe(truncateSql);
  const sucursal = await prisma.sucursal.create({
    data: { nombre: "T15-E POST Sucursal", esPrincipal: true },
  });
  const cliente = await prisma.cliente.create({
    data: { nombre: "T15-E POST Cliente", sucursalId: sucursal.id },
  });
  const producto = await prisma.producto.create({
    data: {
      nombre: "T15-E POST Producto",
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
      stockConsignadoUnits: 5,
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
          unitsEntregadas: 5,
          precioUnitario: 100,
          descuento: 0,
        },
      },
    },
    include: { detalles: { orderBy: { id: "asc" } } },
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
    sendNotification: async () => undefined,
  } as unknown as NonNullable<
    Parameters<typeof handlePostLiquidacionByConsignacion>[2]
  >;

  const request = (detalleId: number, unitsVendidas: number) =>
    new Request(
      `http://localhost/api/liquidaciones/consignacion/${consignacion.id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              consignacionDetalleId: detalleId,
              unitsVendidas,
              unitsDevueltas: 1,
            },
          ],
        }),
      },
    );
  const context = {
    params: Promise.resolve({ consignacionId: String(consignacion.id) }),
  };
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

  // DB_PROJECTION: only StockSucursal is written; the trigger projects once.
  await setMode("DB_PROJECTION");
  const response = await handlePostLiquidacionByConsignacion(
    request(consignacion.detalles[0].id, 2),
    context,
    deps,
  );
  assert.equal(response.status, 201);
  const completed = await state();
  assert.equal(completed[0].stockDisponibleUnits, 11);
  assert.equal(completed[0].stockConsignadoUnits, 2);
  assert.equal(completed[1].stockDisponibleUnits, 11);
  assert.equal(completed[1].stockConsignadoUnits, 2);
  assert.equal(completed[2].unitsVendidasAcum, 2);
  assert.equal(completed[2].unitsDevueltasAcum, 1);
  assert.equal(completed[3], 2);
  assert.equal(await prisma.liquidacion.count(), 1);
  const venta = await prisma.venta.findFirstOrThrow();
  assert.equal(venta.total.toString(), "200");

  // APP_DUAL_WRITE: another consignacion moves both representations.
  await setMode("APP_DUAL_WRITE");
  await dropProjection();
  const consignacionB = await prisma.consignacion.create({
    data: {
      clienteId: cliente.id,
      sucursalId: sucursal.id,
      numeroFolio: 2,
      detalles: {
        create: {
          productoId: producto.id,
          unitsEntregadas: 1,
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
    data: {
      stockDisponibleUnits: { decrement: 1 },
      stockConsignadoUnits: { increment: 1 },
    },
  });
  await prisma.producto.update({
    where: { id: producto.id },
    data: {
      stockDisponibleUnits: { decrement: 1 },
      stockConsignadoUnits: { increment: 1 },
    },
  });
  const beforeDual = await state();
  const dualResponse = await handlePostLiquidacionByConsignacion(
    new Request(
      `http://localhost/api/liquidaciones/consignacion/${consignacionB.id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              consignacionDetalleId: consignacionB.detalles[0].id,
              unitsVendidas: 1,
              unitsDevueltas: 0,
            },
          ],
        }),
      },
    ),
    { params: Promise.resolve({ consignacionId: String(consignacionB.id) }) },
    deps,
  );
  assert.equal(dualResponse.status, 201);
  const afterDual = await state();
  assert.equal(afterDual[0].stockDisponibleUnits, beforeDual[0].stockDisponibleUnits);
  assert.equal(
    afterDual[0].stockConsignadoUnits,
    beforeDual[0].stockConsignadoUnits - 1,
  );
  assert.equal(afterDual[1].stockDisponibleUnits, beforeDual[1].stockDisponibleUnits);
  assert.equal(
    afterDual[1].stockConsignadoUnits,
    beforeDual[1].stockConsignadoUnits - 1,
  );
  assert.equal(afterDual[3], beforeDual[3] + 1);
  assert.equal(await prisma.liquidacion.count(), 2);
  assert.equal(await prisma.venta.count(), 2);

  // Incompatible state: fail closed without creating anything.
  await createProjection();
  const consignacionC = await prisma.consignacion.create({
    data: {
      clienteId: cliente.id,
      sucursalId: sucursal.id,
      numeroFolio: 3,
      detalles: {
        create: {
          productoId: producto.id,
          unitsEntregadas: 1,
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
    data: {
      stockDisponibleUnits: { decrement: 1 },
      stockConsignadoUnits: { increment: 1 },
    },
  });
  const beforeMismatch = await Promise.all([
    prisma.liquidacion.count(),
    prisma.venta.count(),
    prisma.movimientoStock.count(),
    state(),
  ]);
  const rejected = await handlePostLiquidacionByConsignacion(
    new Request(
      `http://localhost/api/liquidaciones/consignacion/${consignacionC.id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              consignacionDetalleId: consignacionC.detalles[0].id,
              unitsVendidas: 1,
              unitsDevueltas: 0,
            },
          ],
        }),
      },
    ),
    {
      params: Promise.resolve({ consignacionId: String(consignacionC.id) }),
    },
    deps,
  );
  assert.equal(rejected.status, 503);
  assert.deepEqual(await rejected.json(), {
    error: "Autoridad de stock no disponible.",
  });
  const afterMismatch = await Promise.all([
    prisma.liquidacion.count(),
    prisma.venta.count(),
    prisma.movimientoStock.count(),
    state(),
  ]);
  assert.deepEqual(afterMismatch, beforeMismatch);
});
