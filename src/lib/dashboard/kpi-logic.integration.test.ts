import assert from "node:assert/strict";
import test from "node:test";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("TEST_DATABASE_URL es obligatoria para esta prueba de integración");
}

const truncateSql = `
  TRUNCATE TABLE
    "Pago", "VentaDetalle", "Venta", "SesionCaja", "Caja", "MovimientoStock",
    "StockSucursal", "Producto", "Cliente", "Usuario", "Configuracion",
    "Sucursal", "VentaNumerador", "ConsignacionNumerador"
  RESTART IDENTITY CASCADE
`;

test("la tendencia usa el total ya neto de la venta", async (t) => {
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET ??= "kpi-integration-only-secret-1234567890";

  const [{ getDashboardTendencia }, { prisma }] = await Promise.all([
    import("@/lib/dashboard/kpi-logic"),
    import("@/lib/prisma"),
  ]);

  t.after(async () => {
    const failures: unknown[] = [];
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
    if (failures.length > 0) {
      throw new AggregateError(failures, "Falló la limpieza de la tendencia");
    }
  });

  await prisma.$executeRawUnsafe(truncateSql);

  const sucursal = await prisma.sucursal.create({
    data: { nombre: "KPI Sucursal", esPrincipal: true },
  });
  await prisma.configuracion.create({ data: { sucursalId: sucursal.id } });
  const cliente = await prisma.cliente.create({
    data: { nombre: "KPI Cliente", sucursalId: sucursal.id },
  });

  // total ya viene neto: 100 bruto - 10 de descuento global.
  await prisma.venta.create({
    data: {
      clienteId: cliente.id,
      sucursalId: sucursal.id,
      fecha: new Date(),
      total: 90,
      descuentoGlobal: 10,
      tipo: "CASUAL",
      metodoPago: "EFECTIVO",
    },
  });

  const result = await getDashboardTendencia(sucursal.id, "month");
  const ventasTotal = result.series.reduce(
    (acc: number, day: { ventasTotal: number }) => acc + day.ventasTotal,
    0,
  );

  assert.equal(
    ventasTotal,
    90,
    "la serie no debe volver a restar descuentoGlobal",
  );
});
