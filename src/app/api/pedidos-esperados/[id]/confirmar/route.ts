// src/app/api/pedidos-esperados/[id]/confirmar/route.ts
// POST: Confirmar llegada total o parcial de un pedido

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";
import { confirmarPedidoSchema } from "@/lib/validators/pedidos-esperados";
import { isGlobalSucursalView } from "@/lib/security/sucursalScope";
import { EstadoPedidoEsperado, EstadoItemPedido } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/pedidos-esperados/[id]/confirmar
 * Confirma la llegada total o parcial de un pedido.
 * - Crea MovimientoStock (ENTRADA, COMPRA) por cada item con cantidadRecibida > 0
 * - Actualiza StockSucursal con upsert
 * - Actualiza estado de cada PedidoEsperadoItem
 * - Actualiza estado del PedidoEsperado
 * Todo en una sola transacción atómica.
 */
export async function POST(req: Request, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (isGlobalSucursalView(auth)) {
    return NextResponse.json(
      {
        error:
          "Vista global en modo solo lectura. Selecciona una sucursal para confirmar pedidos.",
      },
      { status: 409 },
    );
  }

  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json(
      { error: "No tienes permisos (Admin requerido)" },
      { status: 403 },
    );
  }

  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const sucursalId = auth.activeSucursalId;

    if (isNaN(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = confirmarPedidoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validación fallida",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    // 1. Obtener el pedido con sus items
    const pedido = await prisma.pedidoEsperado.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!pedido) {
      return NextResponse.json(
        { error: "Pedido no encontrado" },
        { status: 404 },
      );
    }

    // 2. Verificar pertenencia a la sucursal activa
    if (pedido.sucursalId !== sucursalId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // 3. Verificar que el pedido NO está en estado CONFIRMADO o CANCELADO
    if (pedido.estado === "CONFIRMADO" || pedido.estado === "CANCELADO") {
      return NextResponse.json(
        { error: `No se puede confirmar un pedido en estado ${pedido.estado}` },
        { status: 400 },
      );
    }

    // 4. Validar que los itemId pertenecen al pedido y validar cantidades
    const itemsDelPedido = new Map(pedido.items.map((i) => [i.id, i]));
    const itemsInput = parsed.data.items;

    for (const input of itemsInput) {
      const itemExistente = itemsDelPedido.get(input.itemId);
      if (!itemExistente) {
        return NextResponse.json(
          { error: `Item ${input.itemId} no pertenece a este pedido` },
          { status: 400 },
        );
      }
      // Validar margen de sobre-entrega: cantidadRecibida <= cantidadEsperada * 2
      if (input.cantidadRecibida > itemExistente.cantidadEsperada * 2) {
        return NextResponse.json(
          {
            error: `La cantidad recibida para el item ${input.itemId} excede el doble de la cantidad esperada (${itemExistente.cantidadEsperada * 2})`,
          },
          { status: 400 },
        );
      }
    }

    // Verificar que todos los itemId son válidos antes de continuar (ya fue validado arriba, esta guarda evita errores de undefined en la tx)
    const allItemsValid = itemsInput.every((input) =>
      itemsDelPedido.has(input.itemId),
    );
    if (!allItemsValid) {
      return NextResponse.json(
        { error: "Items inválidos en el payload" },
        { status: 400 },
      );
    }

    // 5. Ejecutar todo dentro de una transacción atómica
    const { pedidoActualizado, movimientos } = await prisma.$transaction(
      async (tx) => {
        const movimientosCreados = [];

        for (const input of itemsInput) {
          if (input.cantidadRecibida <= 0) continue;

          // Validado previamente: allItemsValid asegura que el item existe
          const item = itemsDelPedido.get(input.itemId)!;

          // a. Obtener StockSucursal actual
          const stockActual = await tx.stockSucursal.findUnique({
            where: {
              productoId_sucursalId: {
                productoId: item.productoId,
                sucursalId,
              },
            },
            select: { stockDisponibleUnits: true },
          });

          const stockPrevio = stockActual?.stockDisponibleUnits ?? 0;
          const stockPosterior = stockPrevio + input.cantidadRecibida;

          // b. Crear MovimientoStock
          const movimiento = await tx.movimientoStock.create({
            data: {
              productoId: item.productoId,
              sucursalId,
              tipo: "ENTRADA",
              motivo: "COMPRA",
              cantidad: input.cantidadRecibida,
              stockPrevio,
              stockPosterior,
              observaciones: `Confirmación de pedido #${id}`,
            },
          });
          movimientosCreados.push(movimiento);

          // c. Upsert StockSucursal incrementando stock disponible
          await tx.stockSucursal.upsert({
            where: {
              productoId_sucursalId: {
                productoId: item.productoId,
                sucursalId,
              },
            },
            create: {
              productoId: item.productoId,
              sucursalId,
              stockDisponibleUnits: input.cantidadRecibida,
              stockConsignadoUnits: 0,
              stockMinUnits: 0,
            },
            update: {
              stockDisponibleUnits: { increment: input.cantidadRecibida },
            },
          });

          // c2. Sincronizar stockDisponibleUnits del Producto global
          await tx.producto.update({
            where: { id: item.productoId },
            data: {
              stockDisponibleUnits: { increment: input.cantidadRecibida },
            },
          });

          // d. Actualizar PedidoEsperadoItem estado y cantidadRecibida
          const estadoItem: EstadoItemPedido =
            input.cantidadRecibida >= item.cantidadEsperada
              ? EstadoItemPedido.CONFIRMADO
              : EstadoItemPedido.PARCIAL;

          await tx.pedidoEsperadoItem.update({
            where: { id: input.itemId },
            data: {
              cantidadRecibida: input.cantidadRecibida,
              estado: estadoItem,
            },
          });
        }

        // Construir mapa de items actualizados para determinar estado del pedido
        const itemsActualizados = new Map(
          pedido.items.map((i) => [i.id, i.estado]),
        );
        for (const input of itemsInput) {
          if (input.cantidadRecibida > 0) {
            const item = itemsDelPedido.get(input.itemId)!;
            itemsActualizados.set(
              input.itemId,
              input.cantidadRecibida >= item.cantidadEsperada
                ? EstadoItemPedido.CONFIRMADO
                : EstadoItemPedido.PARCIAL,
            );
          }
        }

        // Determinar estado del pedido
        const estadosItems = Array.from(itemsActualizados.values());
        const estadoPedido: EstadoPedidoEsperado = estadosItems.every(
          (e) => e === EstadoItemPedido.CONFIRMADO,
        )
          ? EstadoPedidoEsperado.CONFIRMADO
          : EstadoPedidoEsperado.PARCIAL;

        // Actualizar PedidoEsperado
        const pedidoUpdated = await tx.pedidoEsperado.update({
          where: { id },
          data: { estado: estadoPedido },
          select: { id: true, estado: true, updatedAt: true },
        });

        return {
          pedidoActualizado: pedidoUpdated,
          movimientos: movimientosCreados,
        };
      },
    );

    return NextResponse.json({
      pedido: pedidoActualizado,
      movimientos: movimientos.map((m) => ({
        id: m.id,
        productoId: m.productoId,
        tipo: m.tipo,
        motivo: m.motivo,
        cantidad: m.cantidad,
        stockPrevio: m.stockPrevio,
        stockPosterior: m.stockPosterior,
      })),
    });
  } catch (error) {
    console.error("Error al confirmar pedido:", error);
    return NextResponse.json(
      { error: "Error interno al confirmar pedido" },
      { status: 500 },
    );
  }
}
