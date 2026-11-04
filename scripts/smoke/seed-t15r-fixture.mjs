// Fixture reproducible del smoke de T15-R.
//
// Crea un comercio mínimo (sucursal, caja abierta, usuario ADMIN, plan con
// consignaciones y OCR, cliente, dos productos con stock y una factura de
// proveedor pendiente) en una base descartable. Nunca corre contra producción:
// exige una base cuyo nombre termine en `_smoke` y una confirmación explícita.
//
// Uso:
//   DATABASE_URL=postgresql://.../t15r_smoke \
//   T15R_CONFIRM_DATABASE=t15r_smoke \
//   SMOKE_PASSWORD='...' \
//   node scripts/smoke/seed-t15r-fixture.mjs

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
const email = process.env.SMOKE_EMAIL ?? "smoke-t15r@example.test";
const password = process.env.SMOKE_PASSWORD;

if (!connectionString) {
  throw new Error("DATABASE_URL es obligatoria");
}

const database = new URL(connectionString).pathname.slice(1);
if (
  !/(?:^|[_-])smoke$/.test(database) ||
  process.env.T15R_CONFIRM_DATABASE !== database
) {
  throw new Error(
    `Este fixture sólo corre sobre una base *_smoke confirmada. Recibido: ${database}`,
  );
}

if (!password) {
  throw new Error("SMOKE_PASSWORD es obligatoria (misma que usa el smoke HTTP)");
}

const pool = new pg.Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const sucursal = await prisma.sucursal.create({
    data: { nombre: "Sucursal Smoke T15R", esPrincipal: true },
  });

  await prisma.configuracion.create({
    data: {
      sucursalId: sucursal.id,
      usarControlDeCaja: true,
      notificarVentas: false,
      notificarStockBajo: false,
      porcentajeInteresTarjeta: 7.5,
    },
  });

  const usuario = await prisma.usuario.create({
    data: {
      nombre: "Smoke T15R",
      email,
      hash: await bcrypt.hash(password, 10),
      rol: "ADMIN",
      sucursalId: sucursal.id,
    },
  });

  const caja = await prisma.caja.create({
    data: { nombre: "Caja Smoke", sucursalId: sucursal.id },
  });
  await prisma.sesionCaja.create({
    data: { cajaId: caja.id, usuarioId: usuario.id, montoInicial: 100 },
  });

  // Los guards de suscripción devuelven 403 sin un plan activo.
  await prisma.plan.create({
    data: {
      id: 3,
      nombre: "Plan Smoke",
      precioARS: "0.00",
      precioUSD: "0.00",
      activo: true,
    },
  });
  await prisma.planLimit.create({
    data: {
      planId: 3,
      maxProductos: -1,
      maxUsuarios: 100,
      maxFacturasOcr: 400,
      allowConsignaciones: true,
      allowSucursales: true,
    },
  });
  await prisma.subscription.create({
    data: {
      userId: usuario.id,
      planId: 3,
      status: "PRUEBA",
      provider: "PROMO",
      externalId: "smoke-t15r",
    },
  });

  const cliente = await prisma.cliente.create({
    data: {
      nombre: "Consumidor Final",
      direccion: "Venta Mostrador",
      sucursalId: sucursal.id,
    },
  });

  const mate = await prisma.producto.create({
    data: {
      nombre: "Mate Smoke",
      precioVenta: "10.01",
      precioCosto: "4.00",
      sucursalId: sucursal.id,
    },
  });
  const termo = await prisma.producto.create({
    data: {
      nombre: "Termo Smoke",
      precioVenta: "5.55",
      precioCosto: "2.00",
      descuentoActivo: true,
      descuentoPorcentaje: "10.00",
      sucursalId: sucursal.id,
    },
  });

  await prisma.stockSucursal.createMany({
    data: [
      { productoId: mate.id, sucursalId: sucursal.id, stockDisponibleUnits: 10 },
      {
        productoId: termo.id,
        sucursalId: sucursal.id,
        stockDisponibleUnits: 8,
      },
    ],
  });

  const proveedor = await prisma.proveedor.create({
    data: {
      nombre: "Proveedor Smoke",
      cuit: "20-99999999-1",
      sucursalId: sucursal.id,
    },
  });

  const factura = await prisma.facturaProveedor.create({
    data: {
      proveedorId: proveedor.id,
      sucursalId: sucursal.id,
      creadoPor: usuario.id,
      archivoPath: "smoke-t15r.pdf",
      archivoMime: "application/pdf",
      numeroFactura: "SMOKE-1",
      moneda: "ARS",
      estado: "PENDIENTE",
    },
  });

  const item = await prisma.facturaProveedorItem.create({
    data: {
      facturaId: factura.id,
      textoOriginal: "Mate Smoke x3",
      cantidad: 3,
      precioUnitario: "100.0000",
      totalLinea: "300.00",
      estado: "PENDIENTE",
    },
  });

  const [productoMate, productoTermo] = await Promise.all([
    prisma.producto.findUniqueOrThrow({ where: { id: mate.id } }),
    prisma.producto.findUniqueOrThrow({ where: { id: termo.id } }),
  ]);

  console.log(
    "SEED",
    JSON.stringify({
      email,
      sucursalId: sucursal.id,
      usuarioId: usuario.id,
      clienteId: cliente.id,
      mateId: mate.id,
      termoId: termo.id,
      mateStock: productoMate.stockDisponibleUnits,
      termoStock: productoTermo.stockDisponibleUnits,
      facturaId: factura.id,
      itemId: item.id,
    }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
