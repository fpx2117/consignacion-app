/* eslint-disable */
// @ts-nocheck
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
    where: { sucursalId: auth.activeSucursalId },
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
    const { clienteId, items, metodoPago, descuentoGlobal } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "La venta debe tener al menos un producto." },
        { status: 400 }
      );
    }

    // ✅ 1. TRAER CONFIGURACIÓN PRIMERO
    const configGlobal = await obtenerConfiguracionGlobal(auth.activeSucursalId);
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
        const sucursalId = auth.activeSucursalId;

        // 1. Obtener stock de la sucursal específica
        const stockSucursalAntes = await tx.stockSucursal.findUnique({
          where: { productoId_sucursalId: { productoId: item.productoId, sucursalId } },
          include: { producto: true }
        });

        if (!stockSucursalAntes) {
          throw new Error(`El producto #${item.productoId} no está asignado a esta sucursal.`);
        }

        if (stockSucursalAntes.stockDisponibleUnits < item.units) {
          throw new Error(`Stock insuficiente para "${stockSucursalAntes.producto.nombre}". Disponibles: ${stockSucursalAntes.stockDisponibleUnits}`);
        }

        // 2. Decrementar stock en la sucursal
        const stockSucursalDespues = await tx.stockSucursal.update({
          where: { id: stockSucursalAntes.id },
          data: { stockDisponibleUnits: { decrement: item.units } },
        });

        // 3. Sincronizar stock global (opcional pero recomendado para consistencia legacy)
        const productoDespues = await tx.producto.update({
          where: { id: item.productoId },
          data: { stockDisponibleUnits: { decrement: item.units } },
        });

        // Auditoría adaptada al estado de la caja
        await tx.movimientoStock.create({
          data: {
            productoId: item.productoId,
            sucursalId,
            tipo: TipoMovimientoStock.SALIDA,
            motivo: MotivoMovimientoStock.VENTA,
            cantidad: item.units,
            stockPrevio: stockSucursalAntes.stockDisponibleUnits,
            stockPosterior: stockSucursalDespues.stockDisponibleUnits,
            observaciones: sesionActiva
              ? `Venta POS - Sesión #${sesionActiva.id}`
              : `Venta POS - Rápida (Sin Caja)`
          }
        });

        const alerta = evaluateStockAlert(productoDespues, configGlobal);
        if (alerta) notificationsQueue.push(alerta);

        const precioVenta = Number(stockSucursalAntes.precioVentaOverride ?? stockSucursalAntes.producto.precioVenta);
        const descuento = Number(item.descuento || 0);
        const subtotal = (precioVenta * item.units) - descuento;
        totalVenta += subtotal;

        detallesData.push({
          productoId: item.productoId,
          units: item.units,
          precioUnitario: precioVenta,
          descuento: descuento,
          subtotal: subtotal,
        });
      }

      // 4. Calcular descuento global y posible interés si es tarjeta
      const descGlobalFinal = Number(descuentoGlobal) || 0;
      let montoInteres = 0;
      const porcentajeInteres = Number(configGlobal.porcentajeInteresTarjeta) || 0;

      if (metodoPago === "TARJETA" && porcentajeInteres > 0) {
        montoInteres = (totalVenta - descGlobalFinal) * (porcentajeInteres / 100);
      }

      const totalFinal = totalVenta - descGlobalFinal + montoInteres;

      // Crear Venta asignando null si no hay sesión
      const nuevaVenta = await tx.venta.create({
        data: {
          tipo: TipoVenta.CASUAL,
          clienteId: finalClienteId,
          sucursalId: auth.activeSucursalId,
          sesionCajaId: sesionActiva?.id || null, // <--- Aquí es clave el ?.
          fecha: new Date(),
          total: totalFinal,
          descuentoGlobal: descGlobalFinal,
          detalles: { create: detallesData },
        },
        include: { detalles: true, cliente: true },
      });

      // Registrar el pago
      const nuevoPago = await tx.pago.create({
        data: {
          clienteId: finalClienteId,
          sesionCajaId: sesionActiva?.id || null, // <--- Aquí también
          fecha: new Date(),
          monto: totalFinal,
          metodo: metodoPago || "EFECTIVO",
        },
      });

      return { venta: nuevaVenta, pago: nuevoPago };
    });

    // Post-Procesamiento
    await processNotificationQueue(notificationsQueue, auth.activeSucursalId);

    // Mensaje de notificación adaptado (Solo si la configuración lo permite)
    if (configGlobal.notificarVentas !== false) {
      // 1. Persistencia en base de datos para el historial
      const clientName = result.venta.cliente?.nombre || "Consumidor Final";
      const clientId = result.venta.clienteId;

      const dbNotif = await prisma.notification.create({
        data: {
          type: "NEW_ORDER",
          title: "Venta Exitosa",
          description: `Venta #${result.venta.id} para [${clientId}] ${clientName} por $${result.venta.total} ARS`,
          fingerprint: `SALE_${result.venta.id}`,
          sucursalId: auth.activeSucursalId,
          read: false,
        }
      }).catch(() => null);

      // 2. Emisión en tiempo real (Socket)
      sendNotification({
        id: dbNotif?.id, // Pasamos el ID real para que useNotifications lo indexe bien
        type: "NEW_ORDER",
        title: "Venta Exitosa",
        message: `Venta #${result.venta.id} por $${result.venta.total}`,
        data: {
          ventaId: result.venta.id,
          notificationId: dbNotif?.id
        }
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