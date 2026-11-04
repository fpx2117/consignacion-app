import assert from "node:assert/strict";
import test from "node:test";
import { acquireT12IntegrationLease } from "@/app/api/t12-route-integration-lease";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("TEST_DATABASE_URL es obligatoria para esta prueba de integración");
}

const truncateSql = `
  TRUNCATE TABLE
    "MovimientoCaja", "Pago", "VentaDetalle", "Venta", "SesionCaja", "Caja",
    "MovimientoStock", "StockSucursal", "Producto", "Cliente", "Usuario",
    "Configuracion", "Sucursal", "VentaNumerador", "ConsignacionNumerador",
    "HorarioLaboral"
  RESTART IDENTITY CASCADE
`;

test("el cierre de caja suma la sesión una sola vez", async (t) => {
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET ??= "t22-integration-only-secret-1234567890";

  const [{ handlePutTurno }, { prisma }] = await Promise.all([
    import("@/app/api/settings/pos/cajas/turno/route"),
    import("@/lib/prisma"),
  ]);
  const releaseLease = await acquireT12IntegrationLease(databaseUrl);

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
    try {
      await releaseLease();
    } catch (error) {
      failures.push(error);
    }
    if (failures.length > 0) {
      throw new AggregateError(failures, "Falló la limpieza del cierre de caja");
    }
  });

  await prisma.$executeRawUnsafe(truncateSql);

  const sucursal = await prisma.sucursal.create({
    data: { nombre: "T22 Sucursal", esPrincipal: true },
  });
  const usuario = await prisma.usuario.create({
    data: {
      nombre: "T22 Usuario",
      email: "t22@example.test",
      hash: "not-used",
      rol: "ADMIN",
      sucursalId: sucursal.id,
    },
  });
  const caja = await prisma.caja.create({
    data: { nombre: "T22 Caja", sucursalId: sucursal.id },
  });
  const sesion = await prisma.sesionCaja.create({
    data: { cajaId: caja.id, usuarioId: usuario.id, montoInicial: 100 },
  });
  const cliente = await prisma.cliente.create({
    data: { nombre: "T22 Cliente", sucursalId: sucursal.id },
  });

  await prisma.venta.create({
    data: {
      clienteId: cliente.id,
      sucursalId: sucursal.id,
      sesionCajaId: sesion.id,
      total: 50,
      tipo: "CASUAL",
      metodoPago: "EFECTIVO",
    },
  });
  await prisma.pago.create({
    data: {
      clienteId: cliente.id,
      sucursalId: sucursal.id,
      sesionCajaId: sesion.id,
      tipo: "DEUDA",
      monto: 20,
      metodo: "EFECTIVO",
    },
  });
  await prisma.movimientoCaja.create({
    data: {
      sesionCajaId: sesion.id,
      tipo: "INGRESO",
      monto: 5,
      motivo: "Aporte",
    },
  });

  const deps = {
    prisma,
    requireAuth: async () => ({
      ok: true as const,
      user: {
        sub: String(usuario.id),
        rol: "ADMIN" as const,
        email: usuario.email,
        nombre: usuario.nombre,
        sucursalId: sucursal.id,
      },
      activeSucursalId: sucursal.id,
      allowedSucursalIds: [sucursal.id],
      isGlobalView: false,
      token: "t22-token",
    }),
    resolveTimezoneForAuth: async () => ({
      tz: "America/Argentina/Buenos_Aires",
      source: "branch",
      userId: usuario.id,
      sucursalId: sucursal.id,
      zonaHorariaUsuario: null,
      zonaHorariaSucursal: "America/Argentina/Buenos_Aires",
    }),
    nowAR: () => new Date("2026-11-04T12:00:00.000Z"),
    getDayOfWeekAR: () => 3,
    getTimeStringAR: () => "12:00",
  } as unknown as NonNullable<Parameters<typeof handlePutTurno>[1]>;

  const request = () =>
    new Request("http://localhost/api/settings/pos/cajas/turno", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ montoReal: 180, observaciones: "Cierre T22" }),
    });

  const first = await handlePutTurno(request(), deps);
  assert.equal(first.status, 200);
  const body = await first.json();
  // 100 inicial + 50 ventas efectivo + 20 cobranzas efectivo + 5 ingresos
  assert.equal(body.extra.esperadoEfectivo, 175);
  assert.equal(body.data.estado, "CERRADA");
  assert.equal(body.data.montoFinalEsperado.toString(), "175");
  assert.equal(body.data.montoFinalReal.toString(), "180");
  assert.equal(body.data.diferencia.toString(), "5");

  // Segundo cierre: la sesión ya no está abierta, no se pisa el resultado.
  const second = await handlePutTurno(request(), deps);
  assert.equal(second.status, 404);
  const persisted = await prisma.sesionCaja.findUniqueOrThrow({
    where: { id: sesion.id },
  });
  assert.equal(persisted.montoFinalEsperado?.toString(), "175");
});
