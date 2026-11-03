import assert from "node:assert/strict";
import test from "node:test";
import { acquireT12IntegrationLease } from "@/app/api/t12-route-integration-lease";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is required for T12 integration");
}

test("uses the PostgreSQL-assigned folio in persistence, response, and stock audit", async (t) => {
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.JWT_SECRET ??= "t12-integration-secret-at-least-32-characters";

  const [{ prisma }, { handlePostConsignacion }] = await Promise.all([
    import("@/lib/prisma"),
    import("./route"),
  ]);
  const releaseLease = await acquireT12IntegrationLease(testDatabaseUrl);
  t.after(async () => {
    const failures: unknown[] = [];
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE public."StockAutoridad" SET "modo" = 'APP_DUAL_WRITE' WHERE "id" = 1`,
      );
    } catch (error) {
      failures.push(error);
    }
    try {
      await prisma.$executeRawUnsafe(`
        TRUNCATE TABLE
          "MovimientoStock", "VentaDetalle", "Pago", "Venta", "LiquidacionItem",
          "Liquidacion", "ConsignacionDetalle", "Consignacion", "SesionCaja",
          "Caja", "StockSucursal", "Producto", "Cliente", "Usuario", "Sucursal",
          "VentaNumerador", "ConsignacionNumerador"
        RESTART IDENTITY CASCADE
      `);
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
      throw new AggregateError(failures, "T12 integration cleanup failed");
    }
  });
  try {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "MovimientoStock", "VentaDetalle", "Pago", "Venta", "LiquidacionItem",
        "Liquidacion", "ConsignacionDetalle", "Consignacion", "SesionCaja",
        "Caja", "StockSucursal", "Producto", "Cliente", "Usuario", "Sucursal",
        "VentaNumerador", "ConsignacionNumerador"
      RESTART IDENTITY CASCADE
    `);
    const sucursal = await prisma.sucursal.create({
      data: { nombre: "T12 Integration", esPrincipal: true },
    });
    const cliente = await prisma.cliente.create({
      data: { nombre: "T12 Client", sucursalId: sucursal.id },
    });
    const producto = await prisma.producto.create({
      data: {
        nombre: "T12 Product",
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
      },
    });
    await prisma.consignacionNumerador.create({
      data: { clienteId: cliente.id, ultimoNumero: 8 },
    });

    // T15-C: the route now obeys the stock capability. This test only covers
    // folio and audit, so use the compatible projection state.
    await prisma.$executeRawUnsafe(
      `UPDATE public."StockAutoridad" SET "modo" = 'DB_PROJECTION' WHERE "id" = 1`,
    );

    const response = await handlePostConsignacion(
      new Request("http://localhost/api/consignaciones", {
        method: "POST",
        body: JSON.stringify({
          clienteId: cliente.id,
          items: [{ productoId: producto.id, unitsEntregadas: 1 }],
        }),
      }),
      {
        prisma,
        requireAuth: async () => ({
          ok: true,
          user: { sub: "1", rol: "ADMIN" },
          token: "t12-test-token",
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
      } as unknown as Parameters<typeof handlePostConsignacion>[1],
    );
    const body = await response.json();
    const persisted = await prisma.consignacion.findFirstOrThrow();
    const movement = await prisma.movimientoStock.findFirstOrThrow();

    assert.equal(response.status, 201);
    assert.equal(persisted.numeroFolio, 9);
    assert.equal(body.data.numeroFolio, 9);
    assert.match(movement.observaciones ?? "", /Folio #9$/);
  } finally {
    // Cleanup is registered before the first destructive statement.
  }
});
