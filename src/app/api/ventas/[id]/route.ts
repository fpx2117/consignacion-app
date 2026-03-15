import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { MotivoMovimientoStock, TipoMovimientoStock } from "@prisma/client";
import { z } from "zod";
import { buildSucursalWhere, isGlobalSucursalView } from "@/lib/sucursalScope";

const ventaAnulacionSchema = z.object({
  motivo: z.string().trim().min(1).optional(),
  brokenItems: z.array(z.number().int().positive()).optional(),
});

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

// GET: Obtener detalle de una venta
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> } // 👈 Cambio 1: Tipo Promise
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  const sucursalWhere = buildSucursalWhere(auth);

  // 👈 Cambio 2: Await params
  const { id: idParam } = await params;
  const id = Number(idParam);

  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const venta = await prisma.venta.findFirst({
    where: { id, ...sucursalWhere },
    include: {
      cliente: true,
      detalles: { include: { producto: { include: { categoria: true } } } },
      liquidacion: true,
    },
  });

  if (!venta) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  return NextResponse.json({ data: venta });
}

// DELETE: Anular venta (soft-delete) con manejo de stock y roturas
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (isGlobalSucursalView(auth)) {
    return NextResponse.json({ error: "Vista global en modo solo lectura. Selecciona una sucursal para anular ventas." }, { status: 409 });
  }

  const { id: idParam } = await params;
  const id = Number(idParam);

  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  // Leer payload del body (motivo obligatorio, brokenItems opcional)
  let motivo = "Sin motivo";
  let brokenItems: number[] = [];
  try {
    const body = await req.json();
    const parsed = ventaAnulacionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validación fallida", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    motivo = parsed.data.motivo ?? motivo;
    brokenItems = parsed.data.brokenItems ?? brokenItems;
  } catch {
    // body vacío es aceptable
  }

  try {
    const venta = await prisma.venta.findFirst({
      where: { id, sucursalId: auth.activeSucursalId },
      include: { detalles: true },
    });

    if (!venta) {
      return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
    }

    if (venta.anulada) {
      return NextResponse.json({ error: "La venta ya fue anulada" }, { status: 400 });
    }

    const sucursalId = venta.sucursalId;

    await prisma.$transaction(async (tx) => {
      // A) Marcar detalles como rotura y restituir stock solo para los no-rotos
      for (const detalle of venta.detalles) {
        const esRotura = brokenItems.includes(detalle.id);

        // Actualizar el flag en el detalle
        if (esRotura) {
          await tx.ventaDetalle.update({
            where: { id: detalle.id },
            data: { esRotura: true },
          });
        }

        if (!esRotura) {
          // Incrementar stock en StockSucursal (si existe registro)
          const stockSucursal = await tx.stockSucursal.findUnique({
            where: { productoId_sucursalId: { productoId: detalle.productoId, sucursalId } },
          });

          if (stockSucursal) {
            const stockPrevio = stockSucursal.stockDisponibleUnits;
            const stockPosterior = stockPrevio + detalle.units;
            await tx.stockSucursal.update({
              where: { id: stockSucursal.id },
              data: { stockDisponibleUnits: { increment: detalle.units } },
            });
            await tx.movimientoStock.create({
              data: {
                productoId: detalle.productoId,
                sucursalId,
                tipo: TipoMovimientoStock.ENTRADA,
                motivo: MotivoMovimientoStock.DEVOLUCION_CLIENTE,
                cantidad: detalle.units,
                stockPrevio,
                stockPosterior,
                observaciones: `Anulación venta #${id} - ${motivo}`,
              },
            });
          }

          // Sincronizar stock global del producto
          await tx.producto.update({
            where: { id: detalle.productoId },
            data: { stockDisponibleUnits: { increment: detalle.units } },
          });
        } else {
          // Rotura: registrar movimiento de pérdida sin devolver stock
          const stockSucursal = await tx.stockSucursal.findUnique({
            where: { productoId_sucursalId: { productoId: detalle.productoId, sucursalId } },
          });
          const stockPrevio = stockSucursal?.stockDisponibleUnits ?? 0;
          await tx.movimientoStock.create({
              data: {
                productoId: detalle.productoId,
                sucursalId,
                tipo: TipoMovimientoStock.SALIDA,
                motivo: MotivoMovimientoStock.ROTURA,
                cantidad: detalle.units,
                stockPrevio,
                stockPosterior: stockPrevio, // stock no cambia
              observaciones: `Rotura en anulación venta #${id} - ${motivo}`,
            },
          });
        }
      }

      // B) Marcar la venta como anulada (soft-delete)
      await tx.venta.update({
        where: { id },
        data: {
          anulada: true,
          motivoAnulacion: motivo,
          fechaAnulacion: new Date(),
        },
      });
    });

    return NextResponse.json({ success: true, message: "Venta anulada correctamente" });

  } catch (error) {
    console.error("Error anulando venta:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Error al anular la venta" },
      { status: 500 }
    );
  }
}
