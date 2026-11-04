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

test("un reintento con la misma Idempotency-Key no duplica el cobro", async (t) => {
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET ??= "pago-idempotency-secret-1234567890";

  const [{ handlePostPago }, { prisma }] = await Promise.all([
    import("@/app/api/pagos/[clienteId]/route"),
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
      throw new AggregateError(failures, "Falló la limpieza del cobro");
    }
  });

  await prisma.$executeRawUnsafe(truncateSql);

  const sucursal = await prisma.sucursal.create({
    data: { nombre: "Pagos Sucursal", esPrincipal: true },
  });
  const usuario = await prisma.usuario.create({
    data: {
      nombre: "Pagos Usuario",
      email: "pagos@example.test",
      hash: "not-used",
      rol: "ADMIN",
      sucursalId: sucursal.id,
    },
  });
  const caja = await prisma.caja.create({
    data: { nombre: "Pagos Caja", sucursalId: sucursal.id },
  });
  await prisma.sesionCaja.create({
    data: { cajaId: caja.id, usuarioId: usuario.id, montoInicial: 0 },
  });
  const cliente = await prisma.cliente.create({
    data: { nombre: "Pagos Cliente", saldoCuenta: 100, sucursalId: sucursal.id },
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
      token: "pagos-token",
    }),
    isGlobalSucursalView: () => false,
  } as unknown as NonNullable<Parameters<typeof handlePostPago>[2]>;

  const context = { params: Promise.resolve({ clienteId: String(cliente.id) }) };
  const request = (idempotencyKey: string) =>
    new Request(`http://localhost/api/pagos/${cliente.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ monto: 30, metodo: "EFECTIVO" }),
    }) as unknown as Request & { headers: Headers };

  const first = await handlePostPago(request("cobro-1") as never, context, deps);
  assert.equal(first.status, 201);
  const firstBody = await first.json();
  assert.equal(firstBody.data.saldo.toString(), "70");

  // Reintento idéntico: mismo pago, sin segundo descuento.
  const replay = await handlePostPago(request("cobro-1") as never, context, deps);
  assert.equal(replay.status, 200);
  const replayBody = await replay.json();
  assert.equal(replayBody.data.pago.id, firstBody.data.pago.id);
  assert.equal(replayBody.data.saldo.toString(), "70");

  assert.equal(await prisma.pago.count(), 1);
  const persisted = await prisma.cliente.findUniqueOrThrow({
    where: { id: cliente.id },
  });
  assert.equal(persisted.saldoCuenta.toString(), "70");

  // Una clave distinta sí registra un cobro nuevo.
  const second = await handlePostPago(
    request("cobro-2") as never,
    context,
    deps,
  );
  assert.equal(second.status, 201);
  const secondBody = await second.json();
  assert.equal(secondBody.data.saldo.toString(), "40");
  assert.equal(await prisma.pago.count(), 2);
});
