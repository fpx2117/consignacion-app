import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { createConsignacionSchema } from "@/lib/validators/consignacion";
import { TipoMovimientoStock, MotivoMovimientoStock } from "@prisma/client";
import { checkFeature } from "@/lib/requireSubscription";

// ✅ Imports Centralizados de Config y Notificaciones
import { obtenerConfiguracionGlobal } from "@/lib/config";
import { evaluateStockAlert, processNotificationQueue } from "@/lib/stock-alerts";

// GET: Listar consignaciones
export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const consignaciones = await prisma.consignacion.findMany({
    where: { sucursalId: auth.activeSucursalId },
    orderBy: { id: "desc" },
    include: {
      cliente: true,
      detalles: { include: { producto: true } },
    },
  });

  return NextResponse.json({ data: consignaciones });
}

// POST: Crear Consignación
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  // Guard: Verificar que el plan permite consignaciones
  const featureCheck = await checkFeature("consignaciones");
  if (!featureCheck.allowed) {
    return NextResponse.json({ error: featureCheck.message, limitReached: true }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createConsignacionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // ✅ 1. Preparar Configuración y Cola de Notificaciones
  const configGlobal = await obtenerConfiguracionGlobal();
  const notificationsQueue: any[] = [];

  const porcentaje = parsed.data.porcentajeAumento || 0;
  const factorAumento = 1 + (porcentaje / 100);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Validar existencia del cliente
      const cliente = await tx.cliente.findUnique({
        where: { id: parsed.data.clienteId },
      });
      if (!cliente) throw new Error("CLIENTE_NO_EXISTE");

      // 2. Lógica de Foliado
      const ultimaConsignacion = await tx.consignacion.findFirst({
        where: { clienteId: parsed.data.clienteId },
        orderBy: { numeroFolio: "desc" },
        select: { numeroFolio: true }
      });

      const nuevoFolio = ultimaConsignacion ? ultimaConsignacion.numeroFolio + 1 : 1;

      // 3. Validar productos y stock en la sucursal activa
      const sucursalId = auth.activeSucursalId;
      const productIds = parsed.data.items.map((i) => i.productoId);

      const stocksSucursal = await tx.stockSucursal.findMany({
        where: {
          productoId: { in: productIds },
          sucursalId
        },
        include: { producto: true }
      });

      const mapStock = new Map(stocksSucursal.map((s) => [s.productoId, s]));

      for (const it of parsed.data.items) {
        const s = mapStock.get(it.productoId);
        if (!s) {
          throw new Error(`PRODUCTO_NO_ASIGNADO_SUCURSAL:${it.productoId}`);
        }
        if (s.stockDisponibleUnits < it.unitsEntregadas) {
          throw new Error(`STOCK_INSUF:${it.productoId}`);
        }
      }

      // 4. Crear consignación
      const consignacion = await tx.consignacion.create({
        data: {
          clienteId: parsed.data.clienteId,
          sucursalId,
          numeroFolio: nuevoFolio,
          estado: "ABIERTA",
          porcentajeAumento: porcentaje,
          detalles: {
            create: parsed.data.items.map((it) => {
              const s = mapStock.get(it.productoId);
              const precioBase = Number(s?.producto.precioVenta || 0);
              const precioFinal = precioBase * factorAumento;

              return {
                productoId: it.productoId,
                unitsEntregadas: it.unitsEntregadas,
                precioUnitario: precioFinal,
              };
            }),
          },
        },
      });

      // ✅ 5. Actualizar Stock en Sucursal, Auditoría y Alertas
      for (const it of parsed.data.items) {
        const sAntes = mapStock.get(it.productoId)!;

        // A) Mover Stock en la Sucursal (Disponible -> Consignado)
        const sDespues = await tx.stockSucursal.update({
          where: { id: sAntes.id },
          data: {
            stockDisponibleUnits: { decrement: it.unitsEntregadas },
            stockConsignadoUnits: { increment: it.unitsEntregadas },
          },
        });

        // B) Sincronizar Stock Global (legacy support)
        const pDespues = await tx.producto.update({
          where: { id: it.productoId },
          data: {
            stockDisponibleUnits: { decrement: it.unitsEntregadas },
            stockConsignadoUnits: { increment: it.unitsEntregadas },
          },
        });

        // C) Registro de MovimientoStock
        await tx.movimientoStock.create({
          data: {
            productoId: it.productoId,
            sucursalId,
            tipo: TipoMovimientoStock.SALIDA,
            motivo: MotivoMovimientoStock.CONSIGNACION,
            cantidad: it.unitsEntregadas,
            stockPrevio: sAntes.stockDisponibleUnits,
            stockPosterior: sDespues.stockDisponibleUnits,
            observaciones: `Entrega de Consignación Folio #${nuevoFolio}`
          }
        });

        const alerta = evaluateStockAlert(pDespues, configGlobal);
        if (alerta) notificationsQueue.push(alerta);
      }

      // Devolver la consignación completa con sus relaciones (opcional, como lo tenías)
      return await tx.consignacion.findUnique({
        where: { id: consignacion.id },
        include: {
          cliente: true,
          detalles: { include: { producto: true } },
        },
      });
    });

    // ✅ 6. DISPARAR NOTIFICACIONES DE STOCK (Centralizado y fuera de la transacción)
    await processNotificationQueue(notificationsQueue);

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