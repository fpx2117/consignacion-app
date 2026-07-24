// src/app/api/pedidos-esperados/[id]/postergar/route.ts
// POST: Postergar la fecha de un pedido

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";
import { postergarPedidoSchema } from "@/lib/validators/pedidos-esperados";
import { isGlobalSucursalView } from "@/lib/security/sucursalScope";
import { EstadoPedidoEsperado } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/pedidos-esperados/[id]/postergar
 * Posterga la fecha esperada del pedido y agrega nota en observaciones.
 */
export async function POST(req: Request, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (isGlobalSucursalView(auth)) {
    return NextResponse.json(
      {
        error:
          "Vista global en modo solo lectura. Selecciona una sucursal para postergar pedidos.",
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
    const parsed = postergarPedidoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validación fallida",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { nuevaFecha, motivo } = parsed.data;
    const nuevaFechaDate = new Date(nuevaFecha);

    // Verificar que nuevaFecha > now()
    if (nuevaFechaDate <= new Date()) {
      return NextResponse.json(
        { error: "La nueva fecha debe ser posterior a la fecha actual" },
        { status: 400 },
      );
    }

    // Obtener el pedido
    const pedido = await prisma.pedidoEsperado.findUnique({
      where: { id },
      select: {
        id: true,
        sucursalId: true,
        estado: true,
        fechaEsperada: true,
        observaciones: true,
      },
    });

    if (!pedido) {
      return NextResponse.json(
        { error: "Pedido no encontrado" },
        { status: 404 },
      );
    }

    // Verificar pertenencia a la sucursal activa
    if (pedido.sucursalId !== sucursalId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Verificar que el pedido NO está CONFIRMADO o CANCELADO
    if (
      pedido.estado === EstadoPedidoEsperado.CONFIRMADO ||
      pedido.estado === EstadoPedidoEsperado.CANCELADO
    ) {
      return NextResponse.json(
        { error: `No se puede postergar un pedido en estado ${pedido.estado}` },
        { status: 400 },
      );
    }

    // Construir nota de postergación con append
    const fechaActual = new Date().toISOString().split("T")[0];
    const notaPostergacion = `[${fechaActual}] Postergado desde ${pedido.fechaEsperada.toISOString()} hasta ${nuevaFechaDate.toISOString()}: ${motivo ?? "Sin motivo"}`;
    const observacionesActualizadas = pedido.observaciones
      ? `${pedido.observaciones}\n${notaPostergacion}`
      : notaPostergacion;

    // Actualizar pedido
    const pedidoActualizado = await prisma.pedidoEsperado.update({
      where: { id },
      data: {
        fechaEsperada: nuevaFechaDate,
        estado: EstadoPedidoEsperado.POSTERGADO,
        observaciones: observacionesActualizadas,
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
    console.error("Error al postergar pedido:", error);
    return NextResponse.json(
      { error: "Error interno al postergar pedido" },
      { status: 500 },
    );
  }
}
