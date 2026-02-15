import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { TipoMovimientoStock, MotivoMovimientoStock } from "@prisma/client";

// ✅ Imports Centralizados de Config y Notificaciones
import { sendNotification } from "@/lib/socket-trigger";
import { obtenerConfiguracionGlobal } from "@/lib/config";
import { evaluateStockAlert, processNotificationQueue } from "@/lib/stock-alerts";

// GET: Listar ventas
export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const ventas = await prisma.venta.findMany({
    orderBy: { id: "desc" },
    include: { cliente: true, detalles: { include: { producto: true } } },
    take: 200,
  });

  return NextResponse.json({ data: ventas });
}

// POST: Crear Venta Directa
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const body = await req.json();
    const { clienteId, items, metodoPago } = body; 

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "La venta debe tener al menos un producto." },
        { status: 400 }
      );
    }

    // ✅ 1. Preparar Configuración y Cola de Notificaciones
    const configGlobal = await obtenerConfiguracionGlobal();
    const notificationsQueue: any[] = [];

    // --- Lógica de Cliente (Consumidor Final) ---
    let finalClienteId = clienteId;
    if (!finalClienteId) {
      const consumidor = await prisma.cliente.findFirst({
        where: { nombre: "Consumidor Final" },
      });
      if (consumidor) {
        finalClienteId = consumidor.id;
      } else {
        const nuevoConsumidor = await prisma.cliente.create({
          data: {
            nombre: "Consumidor Final",
            direccion: "Venta Mostrador",
            saldoCuenta: 0,
            activo: true,
          },
        });
        finalClienteId = nuevoConsumidor.id;
      }
    }

    // ✅ 2. Transacción de Venta
    const result = await prisma.$transaction(async (tx) => {
      let totalVenta = 0;
      const detallesData = [];

      for (const item of items) {
        // A) Verificar existencia y guardar estado PREVIO para auditoría
        const productoAntes = await tx.producto.findUnique({
          where: { id: item.productoId },
        });

        if (!productoAntes) throw new Error(`Producto ID ${item.productoId} no encontrado.`);

        if (productoAntes.stockDisponibleUnits < item.units) {
          throw new Error(
            `Stock insuficiente para "${productoAntes.nombre}". Disponibles: ${productoAntes.stockDisponibleUnits}`
          );
        }

        // B) Restar stock y CAPTURAR el estado POSTERIOR
        const productoDespues = await tx.producto.update({
          where: { id: item.productoId },
          data: {
            stockDisponibleUnits: { decrement: item.units },
          },
        });

        // ✅ C) REGISTRAR AUDITORÍA DE STOCK
        await tx.movimientoStock.create({
          data: {
            productoId: item.productoId,
            tipo: TipoMovimientoStock.SALIDA,
            motivo: MotivoMovimientoStock.VENTA,
            cantidad: item.units,
            stockPrevio: productoAntes.stockDisponibleUnits,
            stockPosterior: productoDespues.stockDisponibleUnits,
            observaciones: "Venta directa en mostrador"
          }
        });

        // ✅ D) EVALUAR ALERTAS CENTRALIZADAS
        const alerta = evaluateStockAlert(productoDespues, configGlobal);
        if (alerta) notificationsQueue.push(alerta);

        // E) Cálculos de Venta
        const subtotal = Number(productoAntes.precioVenta) * item.units;
        totalVenta += subtotal;

        detallesData.push({
          productoId: item.productoId,
          units: item.units,
          precioUnitario: productoAntes.precioVenta,
          subtotal: subtotal,
        });
      }

      // F) Crear Venta
      const nuevaVenta = await tx.venta.create({
        data: {
          clienteId: finalClienteId,
          fecha: new Date(),
          total: totalVenta,
          detalles: { create: detallesData },
        },
        include: { detalles: true, cliente: true },
      });

      // G) Pago
      const nuevoPago = await tx.pago.create({
        data: {
          clienteId: finalClienteId,
          fecha: new Date(),
          monto: totalVenta,
          metodo: metodoPago || "EFECTIVO",
        },
      });

      return { venta: nuevaVenta, pago: nuevoPago };
    });

    // ✅ 3. DISPARAR NOTIFICACIONES DE STOCK (Centralizado)
    await processNotificationQueue(notificationsQueue);

    // ✅ 4. Notificar nueva venta (Sin guardar en DB, solo ruido de caja para UI)
    sendNotification({
      type: "SYSTEM", 
      title: "Nueva Venta",
      message: `Venta #${result.venta.id} completada por $${result.venta.total}`,
    }).catch(() => null);

    return NextResponse.json({ data: result.venta, pago: result.pago });

  } catch (error: any) {
    console.error("Error creando venta:", error);
    return NextResponse.json(
      { error: error.message || "Error interno." },
      { status: 500 }
    );
  }
}