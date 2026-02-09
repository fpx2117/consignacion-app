import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

// GET: Listar ventas (Tu código original)
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

// POST: Crear Venta Directa (Casual)
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const body = await req.json();
    const { clienteId, items, metodoPago } = body;

    // validación básica
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "La venta debe tener al menos un producto." },
        { status: 400 }
      );
    }

    // 1. Determinar el Cliente (Lógica de Consumidor Final)
    let finalClienteId = clienteId;

    if (!finalClienteId) {
      // Buscamos si existe "Consumidor Final"
      const consumidor = await prisma.cliente.findFirst({
        where: { nombre: "Consumidor Final" },
      });

      if (consumidor) {
        finalClienteId = consumidor.id;
      } else {
        // Si no existe, lo creamos al vuelo (Lazy creation)
        const nuevoConsumidor = await prisma.cliente.create({
          data: {
            nombre: "Consumidor Final",
            direccion: "Venta Mostrador",
            telefono: "",
            saldoCuenta: 0,
            activo: true,
            createdAt: new Date(), // Asegúrate de que coincida con tu schema
          },
        });
        finalClienteId = nuevoConsumidor.id;
      }
    }

    // 2. Ejecutar todo en una transacción para asegurar consistencia de datos
    const result = await prisma.$transaction(async (tx) => {
      let totalVenta = 0;
      const detallesData = [];

      // A) Verificar stock y calcular total
      for (const item of items) {
        const producto = await tx.producto.findUnique({
          where: { id: item.productoId },
        });

        if (!producto) {
          throw new Error(`Producto ID ${item.productoId} no encontrado.`);
        }

        if (producto.stockDisponibleUnits < item.units) {
          throw new Error(
            `Stock insuficiente para "${producto.nombre}". Disponibles: ${producto.stockDisponibleUnits}`
          );
        }

        // Restar stock
        await tx.producto.update({
          where: { id: item.productoId },
          data: {
            stockDisponibleUnits: { decrement: item.units },
          },
        });

        const subtotal = Number(producto.precioVenta) * item.units;
        totalVenta += subtotal;

        detallesData.push({
          productoId: item.productoId,
          units: item.units,
          precioUnitario: producto.precioVenta,
          subtotal: subtotal,
        });
      }

      // B) Crear la Venta
      const nuevaVenta = await tx.venta.create({
        data: {
          clienteId: finalClienteId,
          fecha: new Date(),
          total: totalVenta,
          detalles: {
            create: detallesData,
          },
        },
        include: { detalles: true, cliente: true },
      });

      // C) Crear el Pago Automático (ya que es venta directa/casual)
      const nuevoPago = await tx.pago.create({
        data: {
          clienteId: finalClienteId,
          fecha: new Date(),
          monto: totalVenta,
          metodo: metodoPago || "EFECTIVO",
        },
      });

      // D) Actualizar saldo del Cliente (Opcional, pero recomendado para mantener consistencia)
      // En teoría es 0 (Debe X, Paga X), pero si tu lógica suma y resta, hacemos ambas:
      // + Deuda por venta, - Deuda por pago = 0 cambio neto.
      // Aquí solo registramos el movimiento si llevas un histórico estricto, 
      // o simplemente no hacemos nada si el saldo solo refleja deuda pendiente.
      // Haremos la actualización explícita por seguridad:
      await tx.cliente.update({
        where: { id: finalClienteId },
        data: {
          saldoCuenta: {
            increment: 0, // Venta (+Total) - Pago (-Total) = 0
          },
        },
      });

      return { venta: nuevaVenta, pago: nuevoPago };
    });

    return NextResponse.json({ data: result.venta, pago: result.pago });
  } catch (error: any) {
    console.error("Error creando venta:", error);
    return NextResponse.json(
      { error: error.message || "Error interno al procesar la venta." },
      { status: 500 }
    );
  }
}