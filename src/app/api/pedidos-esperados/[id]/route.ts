/* eslint-disable */
// @ts-nocheck
// src/app/api/pedidos-esperados/[id]/route.ts
// GET: Detalle completo del pedido
// PATCH: Actualizar observaciones o cancelar

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/requireAuth";
import { updatePedidoSchema } from "@/lib/validators/pedidos-esperados";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/pedidos-esperados/[id]
 * Retorna el detalle completo del pedido con items y productos.
 */
export async function GET(_: Request, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const sucursalId = auth.activeSucursalId;

    if (isNaN(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const pedido = await prisma.pedidoEsperado.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            producto: {
              select: {
                id: true,
                nombre: true,
                sku: true,
                stockSucursals: {
                  where: { sucursalId },
                  select: { stockDisponibleUnits: true },
                },
              },
            },
          },
        },
      },
    });

    if (!pedido) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    // Verificar que el pedido pertenece a la sucursal activa
    if (pedido.sucursalId !== sucursalId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Aplanar stockDisponibleUnits del producto
    const data = {
      ...pedido,
      items: pedido.items.map((item) => ({
        ...item,
        producto: {
          id: item.producto.id,
          nombre: item.producto.nombre,
          sku: item.producto.sku,
          stockDisponibleUnits:
            item.producto.stockSucursals[0]?.stockDisponibleUnits ?? 0,
        },
      })),
    };

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error al obtener pedido:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * PATCH /api/pedidos-esperados/[id]
 * Permite actualizar observaciones o cambiar estado a CANCELADO.
 * No permite cancelar un pedido ya CONFIRMADO.
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json(
      { error: "No tienes permisos (Admin requerido)" },
      { status: 403 }
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
    const parsed = updatePedidoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validación fallida", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Verificar que el pedido existe y pertenece a la sucursal activa
    const pedidoExistente = await prisma.pedidoEsperado.findUnique({
      where: { id },
      select: { id: true, sucursalId: true, estado: true },
    });

    if (!pedidoExistente) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    if (pedidoExistente.sucursalId !== sucursalId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // No permite cancelar un pedido ya CONFIRMADO
    if (parsed.data.estado === "CANCELADO" && pedidoExistente.estado === "CONFIRMADO") {
      return NextResponse.json(
        { error: "No se puede cancelar un pedido ya confirmado" },
        { status: 400 }
      );
    }

    const pedidoActualizado = await prisma.pedidoEsperado.update({
      where: { id },
      data: {
        ...(parsed.data.observaciones !== undefined
          ? { observaciones: parsed.data.observaciones }
          : {}),
        ...(parsed.data.estado ? { estado: parsed.data.estado } : {}),
      },
      include: {
        items: {
          include: {
            producto: {
              select: { id: true, nombre: true, sku: true },
            },
          },
        },
      },
    });

    return NextResponse.json({ data: pedidoActualizado });
  } catch (error) {
    console.error("Error al actualizar pedido:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
