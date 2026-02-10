import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

// ✅ Imports para Notificaciones
import { sendNotification } from "@/lib/socket-trigger";
// Asegúrate de que la ruta de importación sea la correcta según tu proyecto
import { NOTIFICATION_TYPE } from "@/lib/notificationes/notificaciones-types"; 
import { obtenerConfiguracionGlobal } from "@/lib/config";

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
        // A) Verificar existencia
        const producto = await tx.producto.findUnique({
          where: { id: item.productoId },
        });

        if (!producto) throw new Error(`Producto ID ${item.productoId} no encontrado.`);

        if (producto.stockDisponibleUnits < item.units) {
          throw new Error(
            `Stock insuficiente para "${producto.nombre}". Disponibles: ${producto.stockDisponibleUnits}`
          );
        }

        // B) Restar stock y CAPTURAR el resultado
        const productoActualizado = await tx.producto.update({
          where: { id: item.productoId },
          data: {
            stockDisponibleUnits: { decrement: item.units },
          },
        });

        // -------------------------------------------------------
        // 🔔 LÓGICA DE DETECCIÓN DE STOCK
        // -------------------------------------------------------
        const stockActual = productoActualizado.stockDisponibleUnits;
        
        const umbralAlerta = productoActualizado.stockMinUnits > 0 
          ? productoActualizado.stockMinUnits 
          : configGlobal.minStockGlobal;

        // Caso 1: Se agotó
        if (stockActual <= 0) {
          notificationsQueue.push({
            type: NOTIFICATION_TYPE.OUT_OF_STOCK,
            title: "¡Producto Agotado!",
            message: `Acaban de comprar el último "${productoActualizado.nombre}".`,
            data: { productId: productoActualizado.id }
          });
        } 
        // Caso 2: Stock Bajo
        else if (stockActual <= umbralAlerta) {
          notificationsQueue.push({
            type: NOTIFICATION_TYPE.LOW_STOCK,
            title: "Alerta de Stock",
            message: `Quedan ${stockActual} unidades de "${productoActualizado.nombre}".`,
            data: { productId: productoActualizado.id }
          });
        }
        // -------------------------------------------------------

        const subtotal = Number(producto.precioVenta) * item.units;
        totalVenta += subtotal;

        detallesData.push({
          productoId: item.productoId,
          units: item.units,
          precioUnitario: producto.precioVenta,
          subtotal: subtotal,
        });
      }

      // C) Crear Venta
      const nuevaVenta = await tx.venta.create({
        data: {
          clienteId: finalClienteId,
          fecha: new Date(),
          total: totalVenta,
          detalles: { create: detallesData },
        },
        include: { detalles: true, cliente: true },
      });

      // D) Pago
      const nuevoPago = await tx.pago.create({
        data: {
          clienteId: finalClienteId,
          fecha: new Date(),
          monto: totalVenta,
          metodo: metodoPago || "EFECTIVO",
        },
      });

      // E) Actualizar Saldo
      await tx.cliente.update({
        where: { id: finalClienteId },
        data: { saldoCuenta: { increment: 0 } }, 
      });

      return { venta: nuevaVenta, pago: nuevoPago };
    });

    // ✅ 3. GUARDAR Y DISPARAR NOTIFICACIONES (CORREGIDO)
    // Procesamos la cola: PRIMERO guardamos en DB, LUEGO emitimos socket.
    
    for (const notif of notificationsQueue) {
      try {
        // Generamos un fingerprint único: TIPO + ID_PRODUCTO
        // Esto evita tener 50 notificaciones iguales. Si ya existe, actualiza la fecha.
        const fingerprint = `${notif.type}:PROD_${notif.data.productId}`;

        // A. Guardar en Base de Datos (Upsert)
        const savedNotif = await prisma.notification.upsert({
          where: { fingerprint }, // Buscamos si ya existe esta alerta para este producto
          update: {
            updatedAt: new Date(), // "Revivimos" la notificación subiéndola al tope
            read: false,           // La marcamos como NO leída para que brille el icono
            title: notif.title,
            description: notif.message,
          },
          create: {
            type: notif.type,
            title: notif.title,
            description: notif.message,
            productoId: notif.data.productId,
            fingerprint,
            read: false,
          },
        });

        // B. Enviar Socket con los datos REALES de la DB
        // Esto es vital para que el frontend tenga el ID correcto y la fecha 'createdAt'
        await sendNotification({
          type: savedNotif.type,
          title: savedNotif.title,
          message: savedNotif.description,
          data: { 
            id: savedNotif.id,         // ID real de la base de datos
            productId: savedNotif.productoId,
            createdAt: savedNotif.createdAt // Para el cálculo de "hace 5 min"
          }
        });

      } catch (err) {
        console.error("Error guardando notificación de venta:", err);
      }
    }

    // Opcional: Notificar nueva venta (Sin guardar en DB, solo ruido de caja)
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