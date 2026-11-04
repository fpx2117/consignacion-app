import assert from "node:assert/strict";
import test from "node:test";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("TEST_DATABASE_URL es obligatoria para esta prueba de integración");
}

test("dos confirmaciones concurrentes reclaman el ítem una sola vez", async (t) => {
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET ??= "ocr-claim-secret-1234567890";

  const [{ claimItemState }, { prisma }] = await Promise.all([
    import("@/lib/ocr/claim-item"),
    import("@/lib/prisma"),
  ]);

  t.after(async () => {
    const failures: unknown[] = [];
    try {
      await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE "FacturaProveedorItem", "FacturaProveedor", "Proveedor", "Sucursal" RESTART IDENTITY CASCADE`,
      );
    } catch (error) {
      failures.push(error);
    }
    try {
      await prisma.$disconnect();
    } catch (error) {
      failures.push(error);
    }
    if (failures.length > 0) {
      throw new AggregateError(failures, "Falló la limpieza del reclamo OCR");
    }
  });

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "FacturaProveedorItem", "FacturaProveedor", "Proveedor", "Sucursal" RESTART IDENTITY CASCADE`,
  );

  const sucursal = await prisma.sucursal.create({
    data: { nombre: "OCR Sucursal", esPrincipal: true },
  });
  const proveedor = await prisma.proveedor.create({
    data: { nombre: "OCR Proveedor", sucursalId: sucursal.id },
  });
  const factura = await prisma.facturaProveedor.create({
    data: {
      proveedorId: proveedor.id,
      sucursalId: sucursal.id,
      creadoPor: 1,
      archivoPath: "ocr.pdf",
      archivoMime: "application/pdf",
      estado: "PENDIENTE",
    },
  });
  const item = await prisma.facturaProveedorItem.create({
    data: {
      facturaId: factura.id,
      textoOriginal: "Producto OCR",
      cantidad: 3,
      estado: "PENDIENTE",
    },
  });

  const attempt = () =>
    prisma.$transaction((tx) =>
      claimItemState(tx, { itemId: item.id, estado: "CONFIRMADO" }),
    );

  const [first, second] = await Promise.all([attempt(), attempt()]);

  assert.deepEqual([first, second].sort(), [false, true]);

  const persisted = await prisma.facturaProveedorItem.findUniqueOrThrow({
    where: { id: item.id },
  });
  assert.equal(persisted.estado, "CONFIRMADO");

  // Un tercer intento tampoco la reclama.
  assert.equal(await attempt(), false);
});
