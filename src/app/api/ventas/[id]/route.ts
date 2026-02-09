import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

// GET: Obtener detalle de una venta
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> } // 👈 Cambio 1: Tipo Promise
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  // 👈 Cambio 2: Await params
  const { id: idParam } = await params;
  const id = Number(idParam);

  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const venta = await prisma.venta.findUnique({
    where: { id },
    include: {
      cliente: true,
      detalles: { include: { producto: true } },
      liquidacion: true,
    },
  });

  if (!venta) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  return NextResponse.json({ data: venta });
}

// DELETE: Anular venta y devolver stock
export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> } // 👈 Cambio 1: Tipo Promise
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  // 👈 Cambio 2: Await params
  const { id: idParam } = await params;
  const id = Number(idParam);

  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    // 1. Buscamos la venta con sus detalles para saber qué devolver
    const venta = await prisma.venta.findUnique({
      where: { id },
      include: { detalles: true },
    });

    if (!venta) {
      return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
    }

    // 2. Transacción: Devolver Stock y Borrar Venta
    await prisma.$transaction(async (tx) => {
      // A) Devolver stock de cada producto
      for (const detalle of venta.detalles) {
        await tx.producto.update({
          where: { id: detalle.productoId },
          data: {
            stockDisponibleUnits: { increment: detalle.units },
          },
        });
      }

      // B) Eliminar la venta
      // Nota: Si tienes "onDelete: Cascade" en tu esquema para los detalles,
      // estos se borrarán solos. Si no, deberías borrar primero los detalles.
      await tx.venta.delete({
        where: { id },
      });
      
      // Opcional: Si quisieras revertir el pago o saldo, sería aquí.
    });

    return NextResponse.json({ success: true, message: "Venta anulada y stock restaurado" });

  } catch (error: any) {
    console.error("Error anulando venta:", error);
    return NextResponse.json(
      { error: "Error al anular la venta: " + error.message },
      { status: 500 }
    );
  }
}