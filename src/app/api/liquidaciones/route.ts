import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { createLiquidacionSchema } from "@/lib/validators/consignacion";
import { notifyStockIfNeeded } from "@/lib/notifyStock";

// ------------------------------------------------------------------
// GET /api/liquidaciones
// Lista todas las liquidaciones o filtra por clienteId.
// NOTA: No recibe 'params' porque no es una ruta dinámica [id].
// ------------------------------------------------------------------
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  // Obtenemos parámetros de la URL (query string)
  const { searchParams } = new URL(req.url);
  const clienteId = searchParams.get("clienteId");

  try {
    const where = clienteId ? { consignacion: { clienteId: Number(clienteId) } } : {};

    const liquidaciones = await prisma.liquidacion.findMany({
      where,
      take: 50,
      orderBy: { fecha: "desc" },
      include: {
        consignacion: {
          include: {
            cliente: { select: { nombre: true } },
          },
        },
        items: true,
        venta: true,
      },
    });

    return NextResponse.json({ data: liquidaciones });
  } catch (error) {
    return NextResponse.json({ error: "Error al listar liquidaciones" }, { status: 500 });
  }
}

// ------------------------------------------------------------------
// POST /api/liquidaciones
// Crea una nueva liquidación.
// NOTA: No recibe 'params'.
// ------------------------------------------------------------------
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => null);
  const parsed = createLiquidacionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { consignacionId, items } = parsed.data;
  const affectedProductIds = new Set<number>();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Verificar consignación
      const consignacion = await tx.consignacion.findUnique({
        where: { id: consignacionId },
        include: { detalles: { include: { producto: true } } },
      });

      if (!consignacion) throw new Error("Consignación no encontrada");
      if (consignacion.estado === "CERRADA") throw new Error("La consignación ya está cerrada");

      const detallesMap = new Map(consignacion.detalles.map((d) => [d.id, d]));
      let totalVenta = 0;
      const soldByProduct = new Map<number, { units: number; precioUnitario: number }>();

      const liquidacionItemsData = [];

      // 2. Procesar items y validar stock
      for (const item of items) {
        const det = detallesMap.get(item.consignacionDetalleId);
        if (!det) throw new Error(`Detalle ID ${item.consignacionDetalleId} no pertenece a esta consignación`);

        const vendidas = item.unitsVendidas ?? 0;
        const devueltas = item.unitsDevueltas ?? 0;

        const pendiente = det.unitsEntregadas - det.unitsVendidasAcum - det.unitsDevueltasAcum;
        if (vendidas + devueltas > pendiente) {
          throw new Error(`Excede stock pendiente en producto: ${det.producto.nombre}`);
        }

        affectedProductIds.add(det.productoId);

        // Actualizar acumulados en detalle
        await tx.consignacionDetalle.update({
          where: { id: det.id },
          data: {
            unitsVendidasAcum: { increment: vendidas },
            unitsDevueltasAcum: { increment: devueltas },
          },
        });

        // Actualizar Stock Producto
        await tx.producto.update({
          where: { id: det.productoId },
          data: {
            stockConsignadoUnits: { decrement: vendidas + devueltas },
            ...(devueltas > 0 ? { stockDisponibleUnits: { increment: devueltas } } : {}),
          },
        });

        const precioUnit = Number(det.producto.precioVenta);
        liquidacionItemsData.push({
          consignacionDetalleId: det.id,
          unitsVendidas: vendidas,
          unitsDevueltas: devueltas,
          precioUnitario: precioUnit, // Snapshot del precio
        });

        if (vendidas > 0) {
          totalVenta += vendidas * precioUnit;
          const prev = soldByProduct.get(det.productoId);
          soldByProduct.set(det.productoId, {
            units: (prev?.units ?? 0) + vendidas,
            precioUnitario: precioUnit,
          });
        }
      }

      // 3. Crear Liquidación
      const nuevaLiquidacion = await tx.liquidacion.create({
        data: {
          consignacionId,
          items: { create: liquidacionItemsData },
        },
      });

      // 4. Generar Venta y Saldo (si hubo ventas)
      if (totalVenta > 0) {
        await tx.venta.create({
          data: {
            clienteId: consignacion.clienteId,
            liquidacionId: nuevaLiquidacion.id,
            total: totalVenta,
            detalles: {
              create: Array.from(soldByProduct.entries()).map(([prodId, info]) => ({
                productoId: Number(prodId),
                units: info.units,
                precioUnitario: info.precioUnitario,
                subtotal: info.units * info.precioUnitario,
              })),
            },
          },
        });

        await tx.cliente.update({
          where: { id: consignacion.clienteId },
          data: { saldoCuenta: { increment: totalVenta } },
        });
      }

      // 5. Verificar si se cierra la consignación
      const estadoActualizado = await tx.consignacionDetalle.findMany({
        where: { consignacionId },
      });
      
      const todoLiquidado = estadoActualizado.every(
        (d) => d.unitsEntregadas - d.unitsVendidasAcum - d.unitsDevueltasAcum <= 0
      );

      if (todoLiquidado) {
        await tx.consignacion.update({
          where: { id: consignacionId },
          data: { estado: "CERRADA" },
        });
      }

      return nuevaLiquidacion;
    });

    // Notificaciones fuera de transacción
    for (const pid of affectedProductIds) {
      await notifyStockIfNeeded(pid);
    }

    return NextResponse.json({ data: result }, { status: 201 });

  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Error procesando liquidación" }, { status: 400 });
  }
}