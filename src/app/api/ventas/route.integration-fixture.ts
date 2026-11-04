import assert from "node:assert/strict";

type AppPrisma = typeof import("@/lib/prisma").prisma;

export async function seedVentaIntegrationFixture(prisma: AppPrisma) {
  const principal = await prisma.sucursal.create({
    data: { nombre: "Sucursal T09", esPrincipal: true },
  });
  const secundaria = await prisma.sucursal.create({
    data: { nombre: "Sucursal secundaria T09" },
  });
  const usuario = await prisma.usuario.create({
    data: {
      nombre: "Admin T09",
      email: "admin-t09@example.test",
      hash: "not-used",
      rol: "ADMIN",
      sucursalId: principal.id,
    },
  });
  const cliente = await prisma.cliente.create({
    data: {
      nombre: "Consumidor Final",
      direccion: "Venta Mostrador",
      sucursalId: principal.id,
    },
  });
  const caja = await prisma.caja.create({
    data: { nombre: "Caja T09", sucursalId: principal.id },
  });
  const sesion = await prisma.sesionCaja.create({
    data: { cajaId: caja.id, usuarioId: usuario.id, montoInicial: "100.00" },
  });
  const mate = await prisma.producto.create({
    data: {
      nombre: "Mate",
      precioVenta: "99.99",
      precioCosto: "4.00",
      sucursalId: principal.id,
      // APP_DUAL_WRITE exige que la creación escriba ambas representaciones: el
      // global es la suma de las sucursales. No se delega en el trigger porque
      // una base recién migrada no lo tiene instalado.
      stockDisponibleUnits: 10,
    },
  });
  const termo = await prisma.producto.create({
    data: {
      nombre: "Termo",
      precioVenta: "5.55",
      precioCosto: "2.00",
      descuentoActivo: true,
      descuentoPorcentaje: "10.00",
      sucursalId: principal.id,
      stockDisponibleUnits: 11,
    },
  });

  await prisma.stockSucursal.createMany({
    data: [
      {
        productoId: mate.id,
        sucursalId: principal.id,
        stockDisponibleUnits: 8,
        precioVentaOverride: "10.01",
      },
      {
        productoId: mate.id,
        sucursalId: secundaria.id,
        stockDisponibleUnits: 2,
      },
      {
        productoId: termo.id,
        sucursalId: principal.id,
        stockDisponibleUnits: 9,
      },
      {
        productoId: termo.id,
        sucursalId: secundaria.id,
        stockDisponibleUnits: 2,
      },
    ],
  });

  return { principal, secundaria, usuario, cliente, sesion, mate, termo };
}

type Fixture = Awaited<ReturnType<typeof seedVentaIntegrationFixture>>;
type JsonBody = Awaited<ReturnType<Response["json"]>>;

export function assertVentaResponseContract(body: JsonBody, fixture: Fixture) {
  const { principal, cliente, sesion, mate, termo } = fixture;
  assert.deepEqual(Object.keys(body).sort(), ["data", "pago"]);
  assert.deepEqual(Object.keys(body.data).sort(), [
    "anulada", "cliente", "clienteId", "descuentoGlobal", "detalles",
    "fecha", "fechaAnulacion", "id", "liquidacionId", "metodoPago",
    "motivoAnulacion", "numeroVenta", "sesionCajaId", "sucursalId", "tipo",
    "total",
  ]);
  assert.deepEqual(Object.keys(body.data.cliente).sort(), [
    "activo", "codigoPostal", "createdAt", "direccion", "documento", "email",
    "id", "localidad", "nombre", "provincia", "saldoCuenta", "sucursalId",
    "telefono",
  ]);
  assert.deepEqual(
    { ...body.data.cliente, id: undefined, createdAt: undefined },
    {
      id: undefined, createdAt: undefined, nombre: "Consumidor Final",
      email: null, documento: null, telefono: null,
      direccion: "Venta Mostrador", provincia: null, localidad: null,
      codigoPostal: null, activo: true, saldoCuenta: "0",
      sucursalId: principal.id,
    },
  );
  assert.deepEqual(Object.keys(body.data.detalles[0]).sort(), [
    "descuento", "esRotura", "id", "precioUnitario", "productoId", "subtotal",
    "units", "ventaId",
  ]);
  assert.deepEqual(Object.keys(body.pago).sort(), [
    "clienteId", "fecha", "id", "idempotencyKey", "metodo", "monto",
    "sesionCajaId", "sucursalId", "tipo",
  ]);
  assert.deepEqual(
    {
      clienteId: body.data.clienteId,
      liquidacionId: body.data.liquidacionId,
      fecha: body.data.fecha,
      total: body.data.total,
      descuentoGlobal: body.data.descuentoGlobal,
      sesionCajaId: body.data.sesionCajaId,
      tipo: body.data.tipo,
      metodoPago: body.data.metodoPago,
      sucursalId: body.data.sucursalId,
      numeroVenta: body.data.numeroVenta,
      anulada: body.data.anulada,
      motivoAnulacion: body.data.motivoAnulacion,
      fechaAnulacion: body.data.fechaAnulacion,
    },
    {
      clienteId: cliente.id,
      liquidacionId: null,
      fecha: "2026-02-01T01:00:00.000Z",
      total: "42.99",
      descuentoGlobal: "0.01",
      sesionCajaId: sesion.id,
      tipo: "CASUAL",
      metodoPago: "TARJETA",
      sucursalId: principal.id,
      numeroVenta: 1,
      anulada: false,
      motivoAnulacion: null,
      fechaAnulacion: null,
    },
  );
  assert.deepEqual(
    body.data.detalles.map((detail: Record<string, unknown>) => ({
      productoId: detail.productoId,
      units: detail.units,
      precioUnitario: detail.precioUnitario,
      descuento: detail.descuento,
      subtotal: detail.subtotal,
      esRotura: detail.esRotura,
    })),
    [
      { productoId: mate.id, units: 3, precioUnitario: "10.01", descuento: "0.02", subtotal: "30.01", esRotura: false },
      { productoId: termo.id, units: 2, precioUnitario: "5.55", descuento: "1.11", subtotal: "9.99", esRotura: false },
    ],
  );
  assert.deepEqual(
    { ...body.pago, id: undefined },
    {
      id: undefined, clienteId: cliente.id, sucursalId: principal.id,
      tipo: "VENTA", fecha: "2026-02-01T02:00:00.000Z", monto: "42.99",
      metodo: "TARJETA", sesionCajaId: sesion.id, idempotencyKey: null,
    },
  );
}
