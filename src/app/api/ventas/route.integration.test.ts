import assert from "node:assert/strict";
import test from "node:test";
import { acquireT12IntegrationLease } from "@/app/api/t12-route-integration-lease";
import {
  assertVentaResponseContract,
  seedVentaIntegrationFixture,
} from "@/app/api/ventas/route.integration-fixture";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const truncateSql = `
  TRUNCATE TABLE
    "MovimientoStock", "VentaDetalle", "Pago", "Venta", "SesionCaja",
    "Caja", "StockSucursal", "Producto", "Cliente", "Usuario",
    "Configuracion", "Sucursal", "VentaNumerador", "ConsignacionNumerador"
  RESTART IDENTITY CASCADE
`;

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL es obligatoria para esta prueba de integración");
}

test(
  "persiste y devuelve el contrato real de POST /api/ventas",
  async (t) => {
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.JWT_SECRET ??= "t09-integration-only-secret-1234567890";

    const [{ handlePostVenta }, { prisma }] = await Promise.all([
      import("@/app/api/ventas/route"),
      import("@/lib/prisma"),
    ]);
    const releaseLease = await acquireT12IntegrationLease(testDatabaseUrl);

    const restoreStockAuthority = async () => {
      await prisma.$executeRawUnsafe(
        `UPDATE public."StockAutoridad" SET "modo" = 'APP_DUAL_WRITE' WHERE "id" = 1`,
      );
      await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_catalog.pg_trigger
            WHERE tgrelid = 'public."StockSucursal"'::regclass
              AND tgname = 'trg_sync_producto_stock'
              AND NOT tgisinternal
          ) THEN
            CREATE TRIGGER "trg_sync_producto_stock"
            AFTER INSERT OR UPDATE OR DELETE ON public."StockSucursal"
            FOR EACH ROW EXECUTE FUNCTION public.sync_producto_stock();
          END IF;
        END
        $$;
      `);
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
      if (failures.length > 0) {
        throw new AggregateError(failures, "Falló la limpieza de la integración");
      }
    });
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$executeRawUnsafe(truncateSql);

    const { principal, secundaria, usuario, cliente, sesion, mate, termo } =
      await seedVentaIntegrationFixture(prisma);

    // T15-A: B1 requires APP_DUAL_WRITE with no projection trigger. Seeding ran
    // with the trigger active, so Producto is already reconciled to SUM.
    await prisma.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS "trg_sync_producto_stock" ON public."StockSucursal"`,
    );

    const auth = {
      ok: true as const,
      user: {
        sub: String(usuario.id),
        rol: "ADMIN" as const,
        email: "admin-t09@example.test",
        nombre: "Admin T09",
        sucursalId: principal.id,
      },
      activeSucursalId: principal.id,
      allowedSucursalIds: [principal.id],
      isGlobalView: false,
      token: "integration-token",
    };
    const dates = [
      new Date("2026-02-01T01:00:00.000Z"),
      new Date("2026-02-01T02:00:00.000Z"),
    ];
    let usarControlDeCaja = true;
    const timezonesUsed: string[] = [];
    const deps = {
      prisma,
      requireAuth: async () => auth,
      buildSucursalWhere: () => ({ sucursalId: principal.id }),
      isGlobalSucursalView: () => false,
      obtenerConfiguracionGlobal: async () => ({
        usarControlDeCaja,
        notificarVentas: false,
        porcentajeInteresTarjeta: 7.5,
      }),
      resolveTimezoneForAuth: async () => ({
        tz: "America/Bogota",
        source: "user" as const,
        userId: usuario.id,
        sucursalId: principal.id,
        zonaHorariaUsuario: "America/Bogota",
        zonaHorariaSucursal: null,
      }),
      nowAR: (tz: string) => {
        timezonesUsed.push(tz);
        return dates.shift()!;
      },
      evaluateStockAlert: () => null,
      processNotificationQueue: async () => undefined,
      sendNotification: async () => undefined,
    } as unknown as NonNullable<Parameters<typeof handlePostVenta>[1]>;

    const foreignClient = await prisma.cliente.create({
      data: { nombre: "Cliente otra sucursal", sucursalId: secundaria.id },
    });
    const beforeForeignClientAttempt = await Promise.all([
      prisma.venta.count(),
      prisma.pago.count(),
      prisma.movimientoStock.count(),
      prisma.stockSucursal.findMany({
        orderBy: [{ productoId: "asc" }, { sucursalId: "asc" }],
        select: { productoId: true, sucursalId: true, stockDisponibleUnits: true },
      }),
      prisma.producto.findMany({
        orderBy: { id: "asc" },
        select: { id: true, stockDisponibleUnits: true },
      }),
    ]);
    const foreignClientResponse = await handlePostVenta(
      new Request("http://localhost/api/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId: foreignClient.id,
          items: [{ productoId: mate.id, units: 1 }],
        }),
      }),
      deps,
    );
    assert.equal(foreignClientResponse.status, 409);
    assert.deepEqual(await foreignClientResponse.json(), {
      error: "El cliente seleccionado no pertenece a la sucursal activa.",
    });
    const missingClientResponse = await handlePostVenta(
      new Request("http://localhost/api/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId: 2_147_483_647,
          items: [{ productoId: mate.id, units: 1 }],
        }),
      }),
      deps,
    );
    assert.equal(missingClientResponse.status, 409);
    assert.deepEqual(await missingClientResponse.json(), {
      error: "El cliente seleccionado no pertenece a la sucursal activa.",
    });
    const afterForeignClientAttempt = await Promise.all([
      prisma.venta.count(),
      prisma.pago.count(),
      prisma.movimientoStock.count(),
      prisma.stockSucursal.findMany({
        orderBy: [{ productoId: "asc" }, { sucursalId: "asc" }],
        select: { productoId: true, sucursalId: true, stockDisponibleUnits: true },
      }),
      prisma.producto.findMany({
        orderBy: { id: "asc" },
        select: { id: true, stockDisponibleUnits: true },
      }),
    ]);
    assert.deepEqual(afterForeignClientAttempt, beforeForeignClientAttempt);

    const response = await handlePostVenta(
      new Request("http://localhost/api/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            { productoId: mate.id, units: 3, descuento: 0.02 },
            { productoId: termo.id, units: 2 },
          ],
          descuentoGlobal: 0.01,
          metodoPago: "TARJETA",
        }),
      }),
      deps,
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assertVentaResponseContract(body, {
      principal,
      secundaria,
      usuario,
      cliente,
      sesion,
      mate,
      termo,
    });

    const [venta, pago, stocks, productos, movimientos] = await Promise.all([
      prisma.venta.findUniqueOrThrow({
        where: { id: body.data.id },
        include: { detalles: { orderBy: { id: "asc" } } },
      }),
      prisma.pago.findUniqueOrThrow({ where: { id: body.pago.id } }),
      prisma.stockSucursal.findMany({
        where: { sucursalId: principal.id },
        orderBy: { productoId: "asc" },
      }),
      prisma.producto.findMany({
        where: { id: { in: [mate.id, termo.id] } },
        orderBy: { id: "asc" },
      }),
      prisma.movimientoStock.findMany({ orderBy: { id: "asc" } }),
    ]);

    assert.equal(venta.total.toString(), "42.99");
    assert.equal(venta.descuentoGlobal.toString(), "0.01");
    assert.deepEqual(
      venta.detalles.map((detalle) => [
        detalle.productoId,
        detalle.precioUnitario.toString(),
        detalle.descuento.toString(),
        detalle.subtotal.toString(),
      ]),
      [
        [mate.id, "10.01", "0.02", "30.01"],
        [termo.id, "5.55", "1.11", "9.99"],
      ],
    );
    assert.equal(pago.monto.toString(), "42.99");

    // T09 restaurado: venta y pago se fechan con la timezone resuelta para el
    // usuario, no con una zona fija ni con la del servidor.
    assert.ok(timezonesUsed.length >= 2, "nowAR debe fechar venta y pago");
    assert.ok(
      timezonesUsed.every((tz) => tz === "America/Bogota"),
      `nowAR recibió ${JSON.stringify(timezonesUsed)}`,
    );
    assert.deepEqual(
      stocks.map((stock) => [stock.productoId, stock.stockDisponibleUnits]),
      [
        [mate.id, 5],
        [termo.id, 7],
      ],
    );
    assert.deepEqual(
      productos.map((producto) => [
        producto.id,
        producto.stockDisponibleUnits,
      ]),
      [
        [mate.id, 7],
        [termo.id, 9],
      ],
    );
    assert.deepEqual(
      movimientos.map((movimiento) => ({
        productoId: movimiento.productoId,
        sucursalId: movimiento.sucursalId,
        tipo: movimiento.tipo,
        motivo: movimiento.motivo,
        cantidad: movimiento.cantidad,
        stockPrevio: movimiento.stockPrevio,
        stockPosterior: movimiento.stockPosterior,
        observaciones: movimiento.observaciones,
      })),
      [
        {
          productoId: mate.id,
          sucursalId: principal.id,
          tipo: "SALIDA",
          motivo: "VENTA",
          cantidad: 3,
          stockPrevio: 8,
          stockPosterior: 5,
          observaciones: `Venta POS - Sesión #${sesion.id}`,
        },
        {
          productoId: termo.id,
          sucursalId: principal.id,
          tipo: "SALIDA",
          motivo: "VENTA",
          cantidad: 2,
          stockPrevio: 9,
          stockPosterior: 7,
          observaciones: `Venta POS - Sesión #${sesion.id}`,
        },
      ],
    );
    assert.ok(movimientos.every((movimiento) => movimiento.createdAt instanceof Date));

    await prisma.sesionCaja.update({
      where: { id: sesion.id },
      data: { estado: "CERRADA", fechaCierre: new Date() },
    });
    usarControlDeCaja = false;
    dates.push(
      new Date("2026-02-01T03:00:00.000Z"),
      new Date("2026-02-01T04:00:00.000Z"),
    );

    const defaultResponse = await handlePostVenta(
      new Request("http://localhost/api/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ productoId: mate.id, units: 1 }] }),
      }),
      deps,
    );
    const defaultBody = await defaultResponse.json();

    assert.equal(defaultResponse.status, 200);
    assert.equal(defaultBody.data.numeroVenta, 2);
    assert.equal(defaultBody.data.metodoPago, "EFECTIVO");
    assert.equal(defaultBody.data.sesionCajaId, null);
    assert.equal(defaultBody.data.descuentoGlobal, "0");
    assert.equal(defaultBody.data.total, "10.01");
    assert.equal(defaultBody.pago.metodo, "EFECTIVO");
    assert.equal(defaultBody.pago.sesionCajaId, null);
    assert.equal(defaultBody.pago.monto, "10.01");

    const beforeRejectedWrite = await Promise.all([
      prisma.venta.count(),
      prisma.pago.count(),
      prisma.movimientoStock.count(),
      prisma.stockSucursal.findUniqueOrThrow({
        where: {
          productoId_sucursalId: {
            productoId: mate.id,
            sucursalId: principal.id,
          },
        },
        select: { stockDisponibleUnits: true },
      }),
      prisma.producto.findUniqueOrThrow({
        where: { id: mate.id },
        select: { stockDisponibleUnits: true },
      }),
    ]);
    dates.push(new Date("2026-02-01T05:00:00.000Z"));
    await prisma.$executeRawUnsafe(
      `ALTER TABLE public."Venta" DISABLE TRIGGER "t12_assign_venta_numero"`,
    );
    let rejectedResponse: Response;
    try {
      rejectedResponse = await handlePostVenta(
        new Request("http://localhost/api/ventas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: [{ productoId: mate.id, units: 1 }] }),
        }),
        deps,
      );
    } finally {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE public."Venta" ENABLE TRIGGER "t12_assign_venta_numero"`,
      );
    }

    assert.equal(rejectedResponse.status, 500);
    const afterRejectedWrite = await Promise.all([
      prisma.venta.count(),
      prisma.pago.count(),
      prisma.movimientoStock.count(),
      prisma.stockSucursal.findUniqueOrThrow({
        where: {
          productoId_sucursalId: {
            productoId: mate.id,
            sucursalId: principal.id,
          },
        },
        select: { stockDisponibleUnits: true },
      }),
      prisma.producto.findUniqueOrThrow({
        where: { id: mate.id },
        select: { stockDisponibleUnits: true },
      }),
    ]);
    assert.deepEqual(afterRejectedWrite, beforeRejectedWrite);

    // T15-A: APP_DUAL_WRITE with the projection trigger active is a prohibited
    // combination; the handler must fail closed before any mutation.
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "trg_sync_producto_stock"
      AFTER INSERT OR UPDATE OR DELETE ON public."StockSucursal"
      FOR EACH ROW EXECUTE FUNCTION public.sync_producto_stock()
    `);
    const mismatchBefore = await Promise.all([
      prisma.venta.count(),
      prisma.pago.count(),
      prisma.movimientoStock.count(),
      prisma.stockSucursal.findUniqueOrThrow({
        where: {
          productoId_sucursalId: {
            productoId: mate.id,
            sucursalId: principal.id,
          },
        },
        select: { stockDisponibleUnits: true },
      }),
      prisma.producto.findUniqueOrThrow({
        where: { id: mate.id },
        select: { stockDisponibleUnits: true },
      }),
    ]);
    dates.push(new Date("2026-02-01T06:00:00.000Z"));
    const mismatchResponse = await handlePostVenta(
      new Request("http://localhost/api/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ productoId: mate.id, units: 1 }] }),
      }),
      deps,
    );
    assert.equal(mismatchResponse.status, 503);
    assert.deepEqual(await mismatchResponse.json(), {
      error: "Autoridad de stock no disponible.",
    });
    const mismatchAfter = await Promise.all([
      prisma.venta.count(),
      prisma.pago.count(),
      prisma.movimientoStock.count(),
      prisma.stockSucursal.findUniqueOrThrow({
        where: {
          productoId_sucursalId: {
            productoId: mate.id,
            sucursalId: principal.id,
          },
        },
        select: { stockDisponibleUnits: true },
      }),
      prisma.producto.findUniqueOrThrow({
        where: { id: mate.id },
        select: { stockDisponibleUnits: true },
      }),
    ]);
    assert.deepEqual(mismatchAfter, mismatchBefore);

    // T15-A: DB_PROJECTION writes only StockSucursal and reads what the
    // trigger projected, without applying the delta a second time.
    await prisma.$executeRawUnsafe(
      `DROP TRIGGER "trg_sync_producto_stock" ON public."StockSucursal"`,
    );
    await prisma.$executeRawUnsafe(
      `UPDATE public."StockAutoridad" SET "modo" = 'DB_PROJECTION' WHERE "id" = 1`,
    );
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "trg_sync_producto_stock"
      AFTER INSERT OR UPDATE OR DELETE ON public."StockSucursal"
      FOR EACH ROW EXECUTE FUNCTION public.sync_producto_stock()
    `);
    const projectionBefore = await Promise.all([
      prisma.movimientoStock.count(),
      prisma.stockSucursal.findUniqueOrThrow({
        where: {
          productoId_sucursalId: {
            productoId: mate.id,
            sucursalId: principal.id,
          },
        },
        select: { stockDisponibleUnits: true },
      }),
      prisma.producto.findUniqueOrThrow({
        where: { id: mate.id },
        select: { stockDisponibleUnits: true },
      }),
    ]);
    dates.push(new Date("2026-02-01T07:00:00.000Z"));
    const projectionResponse = await handlePostVenta(
      new Request("http://localhost/api/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ productoId: mate.id, units: 1 }] }),
      }),
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
        select: { stockDisponibleUnits: true },
      }),
      prisma.producto.findUniqueOrThrow({
        where: { id: mate.id },
        select: { stockDisponibleUnits: true },
      }),
    ]);
    assert.equal(projectionAfter[0], projectionBefore[0] + 1);
    assert.equal(
      projectionAfter[1].stockDisponibleUnits,
      projectionBefore[1].stockDisponibleUnits - 1,
    );
    assert.equal(
      projectionAfter[2].stockDisponibleUnits,
      projectionBefore[2].stockDisponibleUnits - 1,
    );
    await prisma.$executeRawUnsafe(
      `DROP TRIGGER "trg_sync_producto_stock" ON public."StockSucursal"`,
    );
    await prisma.$executeRawUnsafe(
      `UPDATE public."StockAutoridad" SET "modo" = 'APP_DUAL_WRITE' WHERE "id" = 1`,
    );
  },
);
