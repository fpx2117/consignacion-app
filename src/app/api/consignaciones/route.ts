
//src/app/api/consignaciones/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { createConsignacionSchema } from "@/lib/validators/consignacion";
import { notifyStockIfNeeded } from "@/lib/notifyStock";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const consignaciones = await prisma.consignacion.findMany({
    orderBy: { id: "desc" },
    include: {
      cliente: true,
      detalles: { include: { producto: true } },
    },
  });

  return NextResponse.json({ data: consignaciones });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => null);
  const parsed = createConsignacionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const affectedProductIds = [...new Set(parsed.data.items.map((i) => i.productoId))];

  // 1. OBTENER EL FACTOR DE AUMENTO
  const porcentaje = parsed.data.porcentajeAumento || 0; 
  const factorAumento = 1 + (porcentaje / 100);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Validar existencia del cliente
      const cliente = await tx.cliente.findUnique({
        where: { id: parsed.data.clienteId },
      });
      if (!cliente) throw new Error("CLIENTE_NO_EXISTE");

      // 2. LÓGICA DE FOLIADO
      const ultimaConsignacion = await tx.consignacion.findFirst({
        where: { clienteId: parsed.data.clienteId },
        orderBy: { numeroFolio: "desc" },
        select: { numeroFolio: true }
      });

      const nuevoFolio = ultimaConsignacion ? ultimaConsignacion.numeroFolio + 1 : 1;

      // 3. Validar productos y stock
      const productIds = parsed.data.items.map((i) => i.productoId);
      const productos = await tx.producto.findMany({
        where: { id: { in: productIds } },
      });

      const mapProd = new Map(productos.map((p) => [p.id, p]));

      for (const it of parsed.data.items) {
        const p = mapProd.get(it.productoId);
        if (!p) throw new Error(`PRODUCTO_NO_EXISTE:${it.productoId}`);
        if (p.stockDisponibleUnits < it.unitsEntregadas) {
          throw new Error(`STOCK_INSUF:${it.productoId}`);
        }
      }

      // 4. Crear consignación con el folio y el porcentaje guardado
      const consignacion = await tx.consignacion.create({
        data: {
          clienteId: parsed.data.clienteId,
          numeroFolio: nuevoFolio,
          estado: "ABIERTA",
          porcentajeAumento: porcentaje, // 👈 Guardamos el % para referencia visual
          detalles: {
            create: parsed.data.items.map((it) => {
              // 👈 LÓGICA DE PRECIO FIJADO
              const prod = mapProd.get(it.productoId);
              const precioBase = Number(prod?.precioVenta || 0);
              const precioFinal = precioBase * factorAumento;

              return {
                productoId: it.productoId,
                unitsEntregadas: it.unitsEntregadas,
                // Guardamos el precio ya calculado. 
                // Asegúrate que tu schema.prisma tenga 'precioUnitario' en ConsignacionDetalle
                precioUnitario: precioFinal, 
              };
            }),
          },
        },
        include: {
          cliente: true,
          detalles: { include: { producto: true } },
        },
      });

      // 5. Actualizar Stock
      for (const it of parsed.data.items) {
        await tx.producto.update({
          where: { id: it.productoId },
          data: {
            stockDisponibleUnits: { decrement: it.unitsEntregadas },
            stockConsignadoUnits: { increment: it.unitsEntregadas },
          },
        });
      }

      return consignacion;
    });

    // Notificaciones
    for (const pid of affectedProductIds) {
      await notifyStockIfNeeded(pid);
    }

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (e: any) {
    const msg = String(e?.message || "");

    if (msg === "CLIENTE_NO_EXISTE") {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }
    if (msg.startsWith("PRODUCTO_NO_EXISTE:")) {
      return NextResponse.json(
        { error: "Producto no encontrado", productoId: Number(msg.split(":")[1]) },
        { status: 404 }
      );
    }
    if (msg.startsWith("STOCK_INSUF:")) {
      return NextResponse.json(
        { error: "Stock insuficiente", productoId: Number(msg.split(":")[1]) },
        { status: 409 }
      );
    }

    console.error("Consignaciones POST error:", e);
    return NextResponse.json({ error: "Error inesperado" }, { status: 500 });
  }
}