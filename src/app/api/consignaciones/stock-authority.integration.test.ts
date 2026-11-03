import assert from "node:assert/strict";
import test from "node:test";
import { acquireT12IntegrationLease } from "@/app/api/t12-route-integration-lease";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("TEST_DATABASE_URL is required for T15-C");
}

const truncateSql = `
  TRUNCATE TABLE
    "MovimientoStock", "VentaDetalle", "Pago", "Venta", "LiquidacionItem",
    "Liquidacion", "ConsignacionDetalle", "Consignacion", "SesionCaja",
    "Caja", "StockSucursal", "Producto", "Cliente", "Usuario", "Sucursal",
    "VentaNumerador", "ConsignacionNumerador"
  RESTART IDENTITY CASCADE
`;

test("consignacion delivery obeys the B1 stock authority", async (t) => {
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET ??= "t15c-consignacion-secret-1234567890";
  const [{ prisma }, { handlePostConsignacion }] = await Promise.all([
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
      throw new AggregateError(failures, "T15-C cleanup failed");
    }
  });

  await prisma.$executeRawUnsafe(truncateSql);
  const sucursal = await prisma.sucursal.create({
    data: { nombre: "T15-C Sucursal", esPrincipal: true },
  });
  const cliente = await prisma.cliente.create({
    data: { nombre: "T15-C Cliente", sucursalId: sucursal.id },
  });
  const producto = await prisma.producto.create({
    data: {
      nombre: "T15-C Producto",
      precioVenta: "100.00",
      precioCosto: "50.00",
      sucursalId: sucursal.id,
    },
  });
  await prisma.stockSucursal.create({
    data: {
      productoId: producto.id,
      sucursalId: sucursal.id,
      stockDisponibleUnits: 5,
      stockConsignadoUnits: 0,
    },
  });

  const request = (units: number) =>
    new Request("http://localhost/api/consignaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clienteId: cliente.id,
        items: [{ productoId: producto.id, unitsEntregadas: units }],
      }),
    });
  const deps = {
    prisma,
    requireAuth: async () => ({
      ok: true as const,
      user: { sub: "1", rol: "ADMIN" as const },
      token: "t15c-token",
      activeSucursalId: sucursal.id,
      allowedSucursalIds: [sucursal.id],
      isGlobalView: false,
    }),
    isGlobalSucursalView: () => false,
    checkFeature: async () => ({ allowed: true }),
    obtenerConfiguracionGlobal: async () => ({
      porcentajeAumentoConsignacion: 0,
    }),
    evaluateStockAlert: () => null,
    processNotificationQueue: async () => undefined,
  } as unknown as NonNullable<Parameters<typeof handlePostConsignacion>[1]>;

  const stockAndProduct = () =>
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
      prisma.movimientoStock.count(),
    ]);

  // APP_DUAL_WRITE: local move and global delta exactly once.
  await setMode("APP_DUAL_WRITE");
  await dropProjection();
  const dualResponse = await handlePostConsignacion(request(2), deps);
  assert.equal(dualResponse.status, 201);
  const dualState = await stockAndProduct();
  assert.equal(dualState[0].stockDisponibleUnits, 3);
  assert.equal(dualState[0].stockConsignadoUnits, 2);
  assert.equal(dualState[1].stockDisponibleUnits, 3);
  assert.equal(dualState[1].stockConsignadoUnits, 2);
  assert.equal(dualState[2], 1);
  const dualMovement = await prisma.movimientoStock.findFirstOrThrow({
    orderBy: { id: "desc" },
  });
  assert.equal(dualMovement.motivo, "CONSIGNACION");
  assert.equal(dualMovement.stockPrevio, 5);
  assert.equal(dualMovement.stockPosterior, 3);

  // DB_PROJECTION: only StockSucursal is written; the trigger projects once.
  await setMode("DB_PROJECTION");
  await createProjection();
  const projectionResponse = await handlePostConsignacion(request(1), deps);
  assert.equal(projectionResponse.status, 201);
  const projectionState = await stockAndProduct();
  assert.equal(projectionState[0].stockDisponibleUnits, 2);
  assert.equal(projectionState[0].stockConsignadoUnits, 3);
  assert.equal(projectionState[1].stockDisponibleUnits, 2);
  assert.equal(projectionState[1].stockConsignadoUnits, 3);
  assert.equal(projectionState[2], 2);

  // Incompatible APP_DUAL_WRITE + active projection fails before creation.
  await setMode("APP_DUAL_WRITE");
  const mismatchBefore = await Promise.all([
    prisma.consignacion.count(),
    prisma.movimientoStock.count(),
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
  const mismatchResponse = await handlePostConsignacion(request(1), deps);
  assert.equal(mismatchResponse.status, 503);
  assert.deepEqual(await mismatchResponse.json(), {
    error: "Autoridad de stock no disponible.",
  });
  const mismatchAfter = await Promise.all([
    prisma.consignacion.count(),
    prisma.movimientoStock.count(),
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
  assert.deepEqual(mismatchAfter, mismatchBefore);
});
