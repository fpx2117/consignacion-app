import assert from "node:assert/strict";
import test from "node:test";
import { acquireT12IntegrationLease } from "@/app/api/t12-route-integration-lease";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("TEST_DATABASE_URL is required for T15-F");
}

const truncateSql = `
  TRUNCATE TABLE
    "MovimientoStock", "VentaDetalle", "Pago", "Venta", "LiquidacionItem",
    "Liquidacion", "ConsignacionDetalle", "Consignacion", "PedidoEsperadoItem",
    "PedidoEsperado", "StockSucursal", "Producto", "Cliente", "SesionCaja",
    "Caja", "Usuario", "Sucursal", "VentaNumerador", "ConsignacionNumerador"
  RESTART IDENTITY CASCADE
`;

test("product creation and stock adjustment obey the B1 authority", async (t) => {
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET ??= "t15f-productos-secret-1234567890";
  const [{ prisma }, postRoute, putRoute] = await Promise.all([
    import("@/lib/prisma"),
    import("./route"),
    import("./[id]/route"),
  ]);
  const { handlePostProducto } = postRoute;
  const { handlePutProducto } = putRoute;
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
      throw new AggregateError(failures, "T15-F cleanup failed");
    }
  });

  await prisma.$executeRawUnsafe(truncateSql);
  const sucursal = await prisma.sucursal.create({
    data: { nombre: "T15-F Sucursal", esPrincipal: true },
  });

  const auth = {
    ok: true as const,
    user: { sub: "1", rol: "ADMIN" as const },
    token: "t15f-token",
    activeSucursalId: sucursal.id,
    allowedSucursalIds: [sucursal.id],
    isGlobalView: false,
  };
  const configuracion = async () => ({
    rubroNegocio: null,
    minStockGlobal: 0,
  });
  const postDeps = {
    prisma,
    requireAuth: async () => auth,
    requireRole: () => true,
    isGlobalSucursalView: () => false,
    checkProductLimit: async () => ({ allowed: true }),
    obtenerConfiguracionGlobal: configuracion,
    validarAtributosFijosProducto: () => null,
    sendNotification: async () => undefined,
    revalidateTag: async () => undefined,
  } as unknown as NonNullable<Parameters<typeof handlePostProducto>[1]>;
  const putDeps = {
    prisma,
    requireAuth: async () => auth,
    requireRole: () => true,
    isGlobalSucursalView: () => false,
    obtenerConfiguracionGlobal: configuracion,
    validarAtributosFijosProducto: () => null,
    deleteFileSystemImage: async () => undefined,
    sendNotification: async () => undefined,
    revalidateTag: async () => undefined,
  } as unknown as NonNullable<Parameters<typeof handlePutProducto>[2]>;

  const createRequest = (nombre: string, stock: number) =>
    new Request("http://localhost/api/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre,
        precioVenta: 100,
        precioCosto: 50,
        stockDisponibleUnits: stock,
        stockMinUnits: 1,
      }),
    });
  const putRequest = (id: number, stock: number) =>
    new Request(`http://localhost/api/productos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stockDisponibleUnits: stock,
        movimientoInfo: {
          tipo: "ENTRADA",
          motivo: "AJUSTE_POSITIVO",
          observaciones: "T15-F adjustment",
        },
      }),
    });
  const productState = (id: number) =>
    Promise.all([
      prisma.stockSucursal.findUniqueOrThrow({
        where: {
          productoId_sucursalId: {
            productoId: id,
            sucursalId: sucursal.id,
          },
        },
      }),
      prisma.producto.findUniqueOrThrow({ where: { id } }),
      prisma.movimientoStock.count({ where: { productoId: id } }),
    ]);

  // A) Creation under APP_DUAL_WRITE.
  await setMode("APP_DUAL_WRITE");
  await dropProjection();
  const dualCreate = await handlePostProducto(
    createRequest("T15-F DUAL", 5),
    postDeps,
  );
  assert.equal(dualCreate.status, 201);
  const dualProduct = await prisma.producto.findFirstOrThrow({
    where: { nombre: "T15-F DUAL" },
  });
  const dualState = await productState(dualProduct.id);
  assert.equal(dualState[0].stockDisponibleUnits, 5);
  assert.equal(dualState[1].stockDisponibleUnits, 5);
  assert.equal(dualState[2], 1);

  // B) Creation under DB_PROJECTION.
  await setMode("DB_PROJECTION");
  await createProjection();
  const projectionCreate = await handlePostProducto(
    createRequest("T15-F PROJ", 3),
    postDeps,
  );
  assert.equal(projectionCreate.status, 201);
  const projectionProduct = await prisma.producto.findFirstOrThrow({
    where: { nombre: "T15-F PROJ" },
  });
  const projectionState = await productState(projectionProduct.id);
  assert.equal(projectionState[0].stockDisponibleUnits, 3);
  assert.equal(projectionState[1].stockDisponibleUnits, 3);
  assert.equal(projectionState[2], 1);

  // C) Incompatible creation fails before persisting.
  await setMode("APP_DUAL_WRITE");
  const beforeMismatchCreate = await prisma.producto.count();
  const rejectedCreate = await handlePostProducto(
    createRequest("T15-F REJECTED", 1),
    postDeps,
  );
  assert.equal(rejectedCreate.status, 503);
  assert.deepEqual(await rejectedCreate.json(), {
    error: "Autoridad de stock no disponible.",
  });
  assert.equal(await prisma.producto.count(), beforeMismatchCreate);

  // D) Absolute adjustment under APP_DUAL_WRITE applies only the delta.
  const putProduct = await prisma.producto.create({
    data: {
      nombre: "T15-F PUT",
      precioVenta: 100,
      precioCosto: 50,
      sucursalId: sucursal.id,
      stockDisponibleUnits: 5,
    },
  });
  await prisma.stockSucursal.create({
    data: {
      productoId: putProduct.id,
      sucursalId: sucursal.id,
      stockDisponibleUnits: 5,
    },
  });
  await setMode("APP_DUAL_WRITE");
  await dropProjection();
  const dualPut = await handlePutProducto(
    putRequest(putProduct.id, 8),
    { params: Promise.resolve({ id: String(putProduct.id) }) },
    putDeps,
  );
  assert.equal(dualPut.status, 200);
  const dualPutBody = await dualPut.json();
  assert.equal(dualPutBody.data.stockDisponibleUnits, 8);
  const dualPutState = await productState(putProduct.id);
  assert.equal(dualPutState[0].stockDisponibleUnits, 8);
  assert.equal(dualPutState[1].stockDisponibleUnits, 8);
  assert.equal(dualPutState[2], 1);
  const dualMovement = await prisma.movimientoStock.findFirstOrThrow({
    where: { productoId: putProduct.id },
    orderBy: { id: "desc" },
  });
  assert.equal(dualMovement.stockPrevio, 5);
  assert.equal(dualMovement.stockPosterior, 8);

  // E) Absolute adjustment under DB_PROJECTION.
  await setMode("DB_PROJECTION");
  await createProjection();
  const projectionPut = await handlePutProducto(
    putRequest(putProduct.id, 6),
    { params: Promise.resolve({ id: String(putProduct.id) }) },
    putDeps,
  );
  assert.equal(projectionPut.status, 200);
  const projectionPutState = await productState(putProduct.id);
  assert.equal(projectionPutState[0].stockDisponibleUnits, 6);
  assert.equal(projectionPutState[1].stockDisponibleUnits, 6);
  assert.equal(projectionPutState[2], 2);
  const projectionMovement = await prisma.movimientoStock.findFirstOrThrow({
    where: { productoId: putProduct.id },
    orderBy: { id: "desc" },
  });
  assert.equal(projectionMovement.stockPrevio, 8);
  assert.equal(projectionMovement.stockPosterior, 6);

  // F) Incompatible adjustment fails before mutating.
  await setMode("APP_DUAL_WRITE");
  const beforeMismatchPut = await productState(putProduct.id);
  const rejectedPut = await handlePutProducto(
    putRequest(putProduct.id, 9),
    { params: Promise.resolve({ id: String(putProduct.id) }) },
    putDeps,
  );
  assert.equal(rejectedPut.status, 503);
  assert.deepEqual(await rejectedPut.json(), {
    error: "Autoridad de stock no disponible.",
  });
  assert.deepEqual(await productState(putProduct.id), beforeMismatchPut);

  // G) Concurrent absolute adjustments read the locked previous value.
  await setMode("APP_DUAL_WRITE");
  await dropProjection();
  const beforeConcurrent = await productState(putProduct.id);
  const concurrentResponses = await Promise.all([
    handlePutProducto(
      putRequest(putProduct.id, 9),
      { params: Promise.resolve({ id: String(putProduct.id) }) },
      putDeps,
    ),
    handlePutProducto(
      putRequest(putProduct.id, 9),
      { params: Promise.resolve({ id: String(putProduct.id) }) },
      putDeps,
    ),
  ]);
  assert.deepEqual(
    concurrentResponses.map((response) => response.status),
    [200, 200],
  );
  const afterConcurrent = await productState(putProduct.id);
  assert.equal(afterConcurrent[0].stockDisponibleUnits, 9);
  assert.equal(afterConcurrent[1].stockDisponibleUnits, 9);
  assert.equal(afterConcurrent[2], beforeConcurrent[2] + 1);

  // H) Product without a branch stock row: create it and apply the full delta.
  const rowlessProduct = await prisma.producto.create({
    data: {
      nombre: "T15-F ROWLESS",
      precioVenta: 100,
      precioCosto: 50,
      sucursalId: sucursal.id,
      stockDisponibleUnits: 0,
    },
  });
  const rowlessPut = await handlePutProducto(
    putRequest(rowlessProduct.id, 4),
    { params: Promise.resolve({ id: String(rowlessProduct.id) }) },
    putDeps,
  );
  assert.equal(rowlessPut.status, 200);
  const rowlessState = await productState(rowlessProduct.id);
  assert.equal(rowlessState[0].stockDisponibleUnits, 4);
  assert.equal(rowlessState[1].stockDisponibleUnits, 4);
  assert.equal(rowlessState[2], 1);
  const rowlessMovement = await prisma.movimientoStock.findFirstOrThrow({
    where: { productoId: rowlessProduct.id },
  });
  assert.equal(rowlessMovement.stockPrevio, 0);
  assert.equal(rowlessMovement.stockPosterior, 4);
});
