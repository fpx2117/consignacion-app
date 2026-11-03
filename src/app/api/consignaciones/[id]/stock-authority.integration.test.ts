import assert from "node:assert/strict";
import test from "node:test";
import { acquireT12IntegrationLease } from "@/app/api/t12-route-integration-lease";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("TEST_DATABASE_URL is required for T15-D");
}

const truncateSql = `
  TRUNCATE TABLE
    "MovimientoStock", "VentaDetalle", "Pago", "Venta", "LiquidacionItem",
    "Liquidacion", "ConsignacionDetalle", "Consignacion", "SesionCaja",
    "Caja", "StockSucursal", "Producto", "Cliente", "Usuario", "Sucursal",
    "VentaNumerador", "ConsignacionNumerador"
  RESTART IDENTITY CASCADE
`;

test("consignacion edit and liquidation obey the B1 stock authority", async (t) => {
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET ??= "t15d-consignacion-secret-1234567890";
  const [{ prisma }, route] = await Promise.all([
    import("@/lib/prisma"),
    import("./route"),
  ]);
  const { handlePutConsignacion, handlePostLiquidacionConsignacion } = route;
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
      throw new AggregateError(failures, "T15-D cleanup failed");
    }
  });

  await prisma.$executeRawUnsafe(truncateSql);
  const sucursal = await prisma.sucursal.create({
    data: { nombre: "T15-D Sucursal", esPrincipal: true },
  });
  const cliente = await prisma.cliente.create({
    data: { nombre: "T15-D Cliente", sucursalId: sucursal.id },
  });
  const productoA = await prisma.producto.create({
    data: {
      nombre: "T15-D A",
      precioVenta: "100.00",
      precioCosto: "50.00",
      sucursalId: sucursal.id,
    },
  });
  const productoB = await prisma.producto.create({
    data: {
      nombre: "T15-D B",
      precioVenta: "50.00",
      precioCosto: "20.00",
      sucursalId: sucursal.id,
    },
  });
  await prisma.stockSucursal.createMany({
    data: [
      {
        productoId: productoA.id,
        sucursalId: sucursal.id,
        stockDisponibleUnits: 20,
      },
      {
        productoId: productoB.id,
        sucursalId: sucursal.id,
        stockDisponibleUnits: 8,
      },
    ],
  });

  const deps = {
    prisma,
    requireAuth: async () => ({
      ok: true as const,
      user: { sub: "1", rol: "ADMIN" as const },
      token: "t15d-token",
      activeSucursalId: sucursal.id,
      allowedSucursalIds: [sucursal.id],
      isGlobalView: false,
    }),
    isGlobalSucursalView: () => false,
    obtenerConfiguracionGlobal: async () => ({
      porcentajeAumentoConsignacion: 0,
    }),
    evaluateStockAlert: () => null,
    processNotificationQueue: async () => undefined,
  } as unknown as NonNullable<Parameters<typeof handlePutConsignacion>[2]>;

  async function createConsignedSale(
    items: Array<{ productoId: number; units: number }>,
    applyGlobalDelta: boolean,
  ) {
    for (const item of items) {
      await prisma.stockSucursal.update({
        where: {
          productoId_sucursalId: {
            productoId: item.productoId,
            sucursalId: sucursal.id,
          },
        },
        data: {
          stockDisponibleUnits: { decrement: item.units },
          stockConsignadoUnits: { increment: item.units },
        },
      });
      if (applyGlobalDelta) {
        await prisma.producto.update({
          where: { id: item.productoId },
          data: {
            stockDisponibleUnits: { decrement: item.units },
            stockConsignadoUnits: { increment: item.units },
          },
        });
      }
    }
    return prisma.consignacion.create({
      data: {
        clienteId: cliente.id,
        sucursalId: sucursal.id,
        numeroFolio: 1,
        detalles: {
          create: items.map((item) => ({
            productoId: item.productoId,
            unitsEntregadas: item.units,
            precioUnitario: 100,
            descuento: 0,
          })),
        },
      },
      include: { detalles: { orderBy: { id: "asc" } } },
    });
  }

  const stockState = (productoId: number) =>
    Promise.all([
      prisma.stockSucursal.findUniqueOrThrow({
        where: {
          productoId_sucursalId: {
            productoId,
            sucursalId: sucursal.id,
          },
        },
      }),
      prisma.producto.findUniqueOrThrow({ where: { id: productoId } }),
      prisma.movimientoStock.count(),
    ]);

  // A) Edit upward under APP_DUAL_WRITE: +2 delivered.
  await setMode("APP_DUAL_WRITE");
  await dropProjection();
  const saleA = await createConsignedSale(
    [{ productoId: productoA.id, units: 4 }],
    true,
  );
  const beforeA = await stockState(productoA.id);
  const putAdjust = await handlePutConsignacion(
    new Request(`http://localhost/api/consignaciones/${saleA.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ productoId: productoA.id, unitsEntregadas: 6 }],
      }),
    }),
    { params: Promise.resolve({ id: String(saleA.id) }) },
    deps,
  );
  assert.equal(putAdjust.status, 200);
  const afterA = await stockState(productoA.id);
  assert.equal(afterA[0].stockDisponibleUnits, beforeA[0].stockDisponibleUnits - 2);
  assert.equal(afterA[0].stockConsignadoUnits, beforeA[0].stockConsignadoUnits + 2);
  assert.equal(afterA[1].stockDisponibleUnits, beforeA[1].stockDisponibleUnits - 2);
  assert.equal(afterA[1].stockConsignadoUnits, beforeA[1].stockConsignadoUnits + 2);
  assert.equal(afterA[2], beforeA[2] + 1);
  assert.equal(
    (await prisma.consignacionDetalle.findUniqueOrThrow({
      where: { id: saleA.detalles[0].id },
    })).unitsEntregadas,
    6,
  );
  const adjustMovement = await prisma.movimientoStock.findFirstOrThrow({
    orderBy: { id: "desc" },
  });
  assert.equal(adjustMovement.motivo, "AJUSTE_NEGATIVO");
  assert.equal(adjustMovement.cantidad, 2);
  assert.equal(adjustMovement.stockPrevio, beforeA[0].stockDisponibleUnits);
  assert.equal(adjustMovement.stockPosterior, afterA[0].stockDisponibleUnits);

  // A2) Edit downward: negative delta inverts both representations once.
  const beforeA2 = await stockState(productoA.id);
  const putDown = await handlePutConsignacion(
    new Request(`http://localhost/api/consignaciones/${saleA.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ productoId: productoA.id, unitsEntregadas: 5 }],
      }),
    }),
    { params: Promise.resolve({ id: String(saleA.id) }) },
    deps,
  );
  assert.equal(putDown.status, 200);
  const afterA2 = await stockState(productoA.id);
  assert.equal(afterA2[0].stockDisponibleUnits, beforeA2[0].stockDisponibleUnits + 1);
  assert.equal(afterA2[0].stockConsignadoUnits, beforeA2[0].stockConsignadoUnits - 1);
  assert.equal(afterA2[1].stockDisponibleUnits, beforeA2[1].stockDisponibleUnits + 1);
  assert.equal(afterA2[1].stockConsignadoUnits, beforeA2[1].stockConsignadoUnits - 1);
  assert.equal(afterA2[2], beforeA2[2] + 1);
  const downMovement = await prisma.movimientoStock.findFirstOrThrow({
    orderBy: { id: "desc" },
  });
  assert.equal(downMovement.motivo, "AJUSTE_POSITIVO");
  assert.equal(downMovement.cantidad, 1);
  assert.equal(downMovement.stockPrevio, beforeA2[0].stockDisponibleUnits);
  assert.equal(downMovement.stockPosterior, afterA2[0].stockDisponibleUnits);

  // B) Remove a product: restore its local and global stock.
  const saleB = await createConsignedSale(
    [
      { productoId: productoA.id, units: 1 },
      { productoId: productoB.id, units: 2 },
    ],
    true,
  );
  const beforeB = await stockState(productoB.id);
  const putRemove = await handlePutConsignacion(
    new Request(`http://localhost/api/consignaciones/${saleB.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ productoId: productoA.id, unitsEntregadas: 1 }],
      }),
    }),
    { params: Promise.resolve({ id: String(saleB.id) }) },
    deps,
  );
  assert.equal(putRemove.status, 200);
  const afterB = await stockState(productoB.id);
  assert.equal(afterB[0].stockDisponibleUnits, beforeB[0].stockDisponibleUnits + 2);
  assert.equal(afterB[0].stockConsignadoUnits, beforeB[0].stockConsignadoUnits - 2);
  assert.equal(afterB[1].stockDisponibleUnits, beforeB[1].stockDisponibleUnits + 2);
  assert.equal(afterB[1].stockConsignadoUnits, beforeB[1].stockConsignadoUnits - 2);
  assert.equal(
    await prisma.consignacionDetalle.count({
      where: { id: saleB.detalles[1].id },
    }),
    0,
  );
  const removeMovement = await prisma.movimientoStock.findFirstOrThrow({
    orderBy: { id: "desc" },
  });
  assert.equal(removeMovement.motivo, "AJUSTE_POSITIVO");
  assert.equal(removeMovement.productoId, productoB.id);
  assert.equal(removeMovement.stockPrevio, beforeB[0].stockDisponibleUnits);
  assert.equal(removeMovement.stockPosterior, afterB[0].stockDisponibleUnits);

  // C) Liquidation under DB_PROJECTION: one projection, sale created.
  await setMode("DB_PROJECTION");
  await createProjection();
  const saleC = await createConsignedSale(
    [{ productoId: productoA.id, units: 4 }],
    false,
  );
  const beforeC = await stockState(productoA.id);
  const liquidationResponse = await handlePostLiquidacionConsignacion(
    new Request(`http://localhost/api/consignaciones/${saleC.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consignacionId: saleC.id,
        items: [
          {
            consignacionDetalleId: saleC.detalles[0].id,
            unitsVendidas: 2,
            unitsDevueltas: 1,
          },
        ],
      }),
    }),
    { params: Promise.resolve({ id: String(saleC.id) }) },
    deps,
  );
  assert.equal(liquidationResponse.status, 201);
  const afterC = await stockState(productoA.id);
  assert.equal(afterC[0].stockDisponibleUnits, beforeC[0].stockDisponibleUnits + 1);
  assert.equal(afterC[0].stockConsignadoUnits, beforeC[0].stockConsignadoUnits - 3);
  assert.equal(afterC[1].stockDisponibleUnits, beforeC[1].stockDisponibleUnits + 1);
  assert.equal(afterC[1].stockConsignadoUnits, beforeC[1].stockConsignadoUnits - 3);
  assert.equal(afterC[2], beforeC[2] + 2);
  const liquidatedDetail = await prisma.consignacionDetalle.findUniqueOrThrow({
    where: { id: saleC.detalles[0].id },
  });
  assert.equal(liquidatedDetail.unitsVendidasAcum, 2);
  assert.equal(liquidatedDetail.unitsDevueltasAcum, 1);
  assert.equal(await prisma.venta.count(), 1);

  // C2) Liquidation with devueltas = 0: only consignado moves.
  const saleC2 = await createConsignedSale(
    [{ productoId: productoA.id, units: 1 }],
    false,
  );
  const beforeC2 = await stockState(productoA.id);
  const noReturnResponse = await handlePostLiquidacionConsignacion(
    new Request(`http://localhost/api/consignaciones/${saleC2.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consignacionId: saleC2.id,
        items: [
          {
            consignacionDetalleId: saleC2.detalles[0].id,
            unitsVendidas: 1,
            unitsDevueltas: 0,
          },
        ],
      }),
    }),
    { params: Promise.resolve({ id: String(saleC2.id) }) },
    deps,
  );
  assert.equal(noReturnResponse.status, 201);
  const afterC2 = await stockState(productoA.id);
  assert.equal(afterC2[0].stockDisponibleUnits, beforeC2[0].stockDisponibleUnits);
  assert.equal(afterC2[0].stockConsignadoUnits, beforeC2[0].stockConsignadoUnits - 1);
  assert.equal(afterC2[1].stockDisponibleUnits, beforeC2[1].stockDisponibleUnits);
  assert.equal(afterC2[1].stockConsignadoUnits, beforeC2[1].stockConsignadoUnits - 1);
  assert.equal(afterC2[2], beforeC2[2] + 1);
  assert.equal(await prisma.venta.count(), 2);

  // D) Incompatible edit fails before touching the detail or stock.
  await setMode("APP_DUAL_WRITE");
  const saleD = await createConsignedSale(
    [{ productoId: productoA.id, units: 1 }],
    false,
  );
  const beforeD = await Promise.all([
    prisma.consignacionDetalle.findUniqueOrThrow({
      where: { id: saleD.detalles[0].id },
    }),
    stockState(productoA.id),
    prisma.movimientoStock.count(),
  ]);
  const rejectedPut = await handlePutConsignacion(
    new Request(`http://localhost/api/consignaciones/${saleD.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ productoId: productoA.id, unitsEntregadas: 2 }],
      }),
    }),
    { params: Promise.resolve({ id: String(saleD.id) }) },
    deps,
  );
  assert.equal(rejectedPut.status, 503);
  assert.deepEqual(await rejectedPut.json(), {
    error: "Autoridad de stock no disponible.",
  });
  const afterD = await Promise.all([
    prisma.consignacionDetalle.findUniqueOrThrow({
      where: { id: saleD.detalles[0].id },
    }),
    stockState(productoA.id),
    prisma.movimientoStock.count(),
  ]);
  assert.deepEqual(afterD, beforeD);

  // E) Incompatible liquidation creates no Liquidacion or Venta.
  const saleE = await createConsignedSale(
    [{ productoId: productoA.id, units: 1 }],
    false,
  );
  const beforeE = await Promise.all([
    prisma.liquidacion.count(),
    prisma.venta.count(),
    prisma.consignacionDetalle.findUniqueOrThrow({
      where: { id: saleE.detalles[0].id },
    }),
    stockState(productoA.id),
  ]);
  const rejectedPost = await handlePostLiquidacionConsignacion(
    new Request(`http://localhost/api/consignaciones/${saleE.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consignacionId: saleE.id,
        items: [
          {
            consignacionDetalleId: saleE.detalles[0].id,
            unitsVendidas: 1,
            unitsDevueltas: 0,
          },
        ],
      }),
    }),
    { params: Promise.resolve({ id: String(saleE.id) }) },
    deps,
  );
  assert.equal(rejectedPost.status, 503);
  assert.deepEqual(await rejectedPost.json(), {
    error: "Autoridad de stock no disponible.",
  });
  const afterE = await Promise.all([
    prisma.liquidacion.count(),
    prisma.venta.count(),
    prisma.consignacionDetalle.findUniqueOrThrow({
      where: { id: saleE.detalles[0].id },
    }),
    stockState(productoA.id),
  ]);
  assert.deepEqual(afterE, beforeE);
});
