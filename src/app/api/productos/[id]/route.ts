// src/app/api/productos/[id]/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/requireAuth";
import { updateProductoSchema } from "@/lib/validators/producto";

// Imports del Sistema de Notificaciones
import { sendNotification } from "@/lib/socket-trigger";
import { NOTIFICATION_TYPE } from "@/lib/notificationes/notificaciones-types";
import { obtenerConfiguracionGlobal } from "@/lib/config";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET: Obtener un producto por ID
 * Incluye la categoría para facilitar la edición en el frontend.
 */
export async function GET(_: Request, { params }: RouteParams) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const { id: rawId } = await params;
    const id = Number(rawId);

    if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const producto = await prisma.producto.findUnique({ 
      where: { id },
      include: { categoria: true } 
    });

    if (!producto) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

    return NextResponse.json({ data: producto });
  } catch (error) {
    console.error("Error al obtener producto:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * PUT: Actualizar datos del producto
 * Lógica mejorada: incluye fecha de vencimiento en las alertas de stock.
 */
export async function PUT(req: Request, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = updateProductoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validación fallida", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const configGlobal = await obtenerConfiguracionGlobal();

    const updated = await prisma.producto.update({
      where: { id },
      data: {
        ...parsed.data,
        // Convertimos string ISO a objeto Date si la fecha viene en el body
        fechaVencimiento: parsed.data.fechaVencimiento ? new Date(parsed.data.fechaVencimiento) : undefined,
      },
    });

    // --- LÓGICA DE NOTIFICACIÓN POR STOCK ---
    if (parsed.data.stockDisponibleUnits !== undefined) {
      const nuevoStock = updated.stockDisponibleUnits;
      const umbralAlerta = updated.stockMinUnits > 0 
        ? updated.stockMinUnits 
        : configGlobal.minStockGlobal;

      // Formatear fecha de vencimiento para el mensaje
      const fechaVencMsg = updated.fechaVencimiento 
        ? ` (Vence el: ${new Date(updated.fechaVencimiento).toLocaleDateString('es-AR')})` 
        : "";

      if (nuevoStock <= 0) {
        await sendNotification({
          type: NOTIFICATION_TYPE.OUT_OF_STOCK,
          title: "Stock Agotado",
          message: `El producto "${updated.nombre}" se quedó sin unidades.${fechaVencMsg}`,
          data: { productId: updated.id }
        });
      } else if (nuevoStock <= umbralAlerta) {
        await sendNotification({
          type: NOTIFICATION_TYPE.LOW_STOCK,
          title: "Stock Bajo",
          message: `"${updated.nombre}" alcanzó el nivel crítico con ${nuevoStock} u.${fechaVencMsg}`,
          data: { productId: updated.id }
        });
      }
    }

    return NextResponse.json({ data: updated });

  } catch (error: any) {
    // Captura de duplicados (P2002) para Código de Barras o SKU
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: "El código de barras o SKU ya está en uso por otro producto." },
        { status: 400 }
      );
    }
    console.error("Error al actualizar producto:", error);
    return NextResponse.json({ error: "Error interno al actualizar" }, { status: 500 });
  }
}

/**
 * DELETE: Desactivación lógica
 * Marca activo: false para preservar la integridad de ventas pasadas.
 */
export async function DELETE(_: Request, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  if (!requireRole(auth.user, ["ADMIN"])) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id: rawId } = await params;
  const id = Number(rawId);

  try {
    // No usamos prisma.delete para evitar errores de Foreign Key en cascada
    await prisma.producto.update({
      where: { id },
      data: { activo: false }
    });
    return NextResponse.json({ data: { success: true, message: "Producto desactivado" } });
  } catch (error) {
    console.error("Error al desactivar producto:", error);
    return NextResponse.json({ error: "No se pudo desactivar el producto" }, { status: 500 });
  }
}