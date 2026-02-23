// src/app/api/ventas/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { TipoMovimientoStock, MotivoMovimientoStock, TipoVenta } from "@prisma/client";

import { sendNotification } from "@/lib/socket-trigger";
import { obtenerConfiguracionGlobal } from "@/lib/config";
import { evaluateStockAlert, processNotificationQueue } from "@/lib/stock-alerts";

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

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const payload = auth.user as any;
  const rawId = payload.id || payload.userId || payload.usuarioId || payload.sub;
  const usuarioId = Number(rawId);

  if (!rawId || isNaN(usuarioId)) {
    return NextResponse.json(
      { error: "Identificación de usuario fallida. Reingresa al sistema." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { clienteId, items, metodoPago } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "La venta debe tener al menos un producto." },
        { status: 400 }
      );
    }

    // ✅ 1. TRAER CONFIGURACIÓN PRIMERO
    const configGlobal = await obtenerConfiguracionGlobal();
    // Asumimos que si no existe el campo en DB aún, por defecto es estricto (true)
    const usaCaja = configGlobal.usarControlDeCaja ?? true;

    // ✅ 2. VERIFICAR SESIÓN DE CAJA (Condicional)
    const sesionActiva = await prisma.sesionCaja.findFirst({
      where: {
        usuarioId: usuarioId,
        estado: "ABIERTA",
      },
    });

    // Si el sistema exige caja Y no hay caja abierta, bloqueamos.
    if (usaCaja && !sesionActiva) {
      return NextResponse.json(
        { error: "Operación bloqueada: Debes abrir un turno de caja para realizar ventas casuales." },
        { status: 403 }
      );
    }

    const notificationsQueue: any[] = [];

    // Lógica de Cliente
    let finalClienteId = clienteId;
    if (!finalClienteId) {
      const consumidor = await prisma.cliente.findFirst({
        where: { nombre: "Consumidor Final" },
      });
      finalClienteId = consumidor ? consumidor.id : (await prisma.cliente.create({
        data: { nombre: "Consumidor Final", direccion: "Venta Mostrador", activo: true },
      })).id;
    }

    // ✅ 3. TRANSACCIÓN DE VENTA ADAPTADA
    const result = await prisma.$transaction(async (tx) => {
      let totalVenta = 0;
      const detallesData = [];

      for (const item of items) {
        const productoAntes = await tx.producto.findUnique({
          where: { id: item.productoId },
        });

        if (!productoAntes) throw new Error(`Producto #${item.productoId} no existe.`);

        if (productoAntes.stockDisponibleUnits < item.units) {
          throw new Error(`Stock insuficiente para "${productoAntes.nombre}". Disponibles: ${productoAntes.stockDisponibleUnits}`);
        }

        const productoDespues = await tx.producto.update({
          where: { id: item.productoId },
          data: { stockDisponibleUnits: { decrement: item.units } },
        });

        // Auditoría adaptada al estado de la caja
        await tx.movimientoStock.create({
          data: {
            productoId: item.productoId,
            tipo: TipoMovimientoStock.SALIDA,
            motivo: MotivoMovimientoStock.VENTA,
            cantidad: item.units,
            stockPrevio: productoAntes.stockDisponibleUnits,
            stockPosterior: productoDespues.stockDisponibleUnits,
            observaciones: sesionActiva
              ? `Venta POS - Sesión #${sesionActiva.id}`
              : `Venta POS - Rápida (Sin Caja)`
          }
        });

        const alerta = evaluateStockAlert(productoDespues, configGlobal);
        if (alerta) notificationsQueue.push(alerta);

        const subtotal = Number(productoAntes.precioVenta) * item.units;
        totalVenta += subtotal;

        detallesData.push({
          productoId: item.productoId,
          units: item.units,
          precioUnitario: productoAntes.precioVenta,
          subtotal: subtotal,
        });
      }

      // Crear Venta asignando null si no hay sesión
      const nuevaVenta = await tx.venta.create({
        data: {
          tipo: TipoVenta.CASUAL,
          clienteId: finalClienteId,
          sesionCajaId: sesionActiva?.id || null, // <--- Aquí es clave el ?.
          fecha: new Date(),
          total: totalVenta,
          detalles: { create: detallesData },
        },
        include: { detalles: true, cliente: true },
      });

      // Registrar el pago asignando null si no hay sesión
      const nuevoPago = await tx.pago.create({
        data: {
          clienteId: finalClienteId,
          sesionCajaId: sesionActiva?.id || null, // <--- Aquí también
          fecha: new Date(),
          monto: totalVenta,
          metodo: metodoPago || "EFECTIVO",
        },
      });

      return { venta: nuevaVenta, pago: nuevoPago };
    });

    // Post-Procesamiento
    await processNotificationQueue(notificationsQueue);

    // Mensaje de notificación adaptado (Solo si la configuración lo permite)
    if (configGlobal.notificarVentas !== false) {
      const cajaInfo = sesionActiva ? `(Caja: ${sesionActiva.cajaId})` : `(Modo Sin Caja)`;
      sendNotification({
        type: "SYSTEM",
        title: "Venta Exitosa",
        message: `Venta #${result.venta.id} por $${result.venta.total} ${cajaInfo}`,
      }).catch(() => null);
    }

    return NextResponse.json({ data: result.venta, pago: result.pago });

  } catch (error: any) {
    console.error("Error POS:", error);
    return NextResponse.json(
      { error: error.message || "Error al procesar la venta." },
      { status: 500 }
    );
  }
}