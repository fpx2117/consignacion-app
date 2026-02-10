import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/requireAuth";
import { updateProductoSchema } from "@/lib/validators/producto";

// ✅ Imports del Sistema de Notificaciones
import { sendNotification } from "@/lib/socket-trigger";
import { NOTIFICATION_TYPE } from "@/lib/notificationes/notificaciones-types";
import { obtenerConfiguracionGlobal } from "@/lib/config";

type RouteParams = { params: Promise<{ id: string }> };

// --- GET: OBTENER UN PRODUCTO ---
export async function GET(_: Request, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const { id: rawId } = await params;
  const id = Number(rawId);

  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const producto = await prisma.producto.findUnique({ where: { id } });
  if (!producto) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json({ data: producto });
}

// --- PUT: ACTUALIZAR PRODUCTO ---
export async function PUT(req: Request, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: rawId } = await params;
  const id = Number(rawId);

  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Body inválido o vacío" }, { status: 400 });
  }

  // Validar Schema (Zod)
  const parsed = updateProductoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { 
        error: "Validación fallida", 
        details: parsed.error.flatten().fieldErrors 
      },
      { status: 400 }
    );
  }

  // Verificar existencia previa
  const exists = await prisma.producto.findUnique({ where: { id } });
  if (!exists) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  try {
    // 1. Obtener configuración global antes de actualizar
    const configGlobal = await obtenerConfiguracionGlobal();

    // 2. Actualizar en Base de Datos
    const updated = await prisma.producto.update({
      where: { id },
      data: parsed.data, 
    });

    // 3. ✅ LÓGICA DE NOTIFICACIÓN INTELIGENTE
    // Solo notificamos si el stock cambió y está en niveles críticos
    if (parsed.data.stockDisponibleUnits !== undefined) {
      
      const nuevoStock = updated.stockDisponibleUnits;
      
      // Definir umbral: Específico del producto > Global
      const umbralAlerta = updated.stockMinUnits > 0 
        ? updated.stockMinUnits 
        : configGlobal.minStockGlobal;

      // CASO A: Se puso en 0 (Agotado)
      if (nuevoStock <= 0) {
        await sendNotification({
          type: NOTIFICATION_TYPE.OUT_OF_STOCK,
          title: "Stock Agotado (Manual)",
          message: `El inventario de "${updated.nombre}" se ha puesto en 0 manualmente.`,
          data: { productId: updated.id }
        });
      }
      // CASO B: Se puso en nivel bajo (Advertencia)
      else if (nuevoStock <= umbralAlerta) {
        await sendNotification({
          type: NOTIFICATION_TYPE.LOW_STOCK,
          title: "Stock Bajo detectado",
          message: `Ajuste manual: "${updated.nombre}" quedó con ${nuevoStock} u. (Mínimo: ${umbralAlerta})`,
          data: { productId: updated.id }
        });
      }
    }

    return NextResponse.json({ data: updated });

  } catch (error) {
    console.error("Error en Prisma UPDATE:", error);
    return NextResponse.json(
      { error: "Error interno al actualizar el producto" }, 
      { status: 500 }
    );
  }
}

// --- DELETE: ELIMINAR PRODUCTO ---
export async function DELETE(_: Request, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: rawId } = await params;
  const id = Number(rawId);

  if (!Number.isFinite(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    await prisma.producto.delete({ where: { id } });
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    // Error típico de Foreign Key (si ya se vendió, no se puede borrar)
    return NextResponse.json(
      { error: "No se puede eliminar: El producto tiene ventas o movimientos asociados." }, 
      { status: 409 }
    );
  }
}