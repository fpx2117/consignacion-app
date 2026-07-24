//src/app/api/notificaciones/route.ts
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth"; // 🔒 Seguridad
import {
  buildSucursalWhere,
  isGlobalSucursalView,
} from "@/lib/security/sucursalScope";

// --- GET: Obtener lista y contador ---
export async function GET(req: Request) {
  try {
    // 1. Verificación de Seguridad
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const sucursalWhere = buildSucursalWhere(auth);
    const { searchParams } = new URL(req.url);
    const onlyUnread = searchParams.get("onlyUnread") === "true";
    const rawLimit = Number(searchParams.get("limit") || 50);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), 200)
      : 50;

    const baseWhere: Prisma.NotificationWhereInput = {
      ...sucursalWhere,
      ...(onlyUnread ? { read: false } : {}),
    };

    const notifications = await prisma.notification.findMany({
      where: baseWhere,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        producto: {
          select: { id: true, nombre: true },
        },
      },
    });

    // 3. Contador de no leídas solo de esta sucursal
    const unreadCount = await prisma.notification.count({
      where: { ...sucursalWhere, read: false },
    });

    return NextResponse.json({
      data: notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Error interno al obtener notificaciones" },
      { status: 500 },
    );
  }
}

// --- PATCH: Marcar como Leídas ---
export async function PATCH(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (isGlobalSucursalView(auth)) {
      return NextResponse.json(
        {
          error:
            "Vista global en modo solo lectura. Selecciona una sucursal para actualizar notificaciones.",
        },
        { status: 409 },
      );
    }

    const sucursalId = auth.activeSucursalId;
    const body = await req.json().catch(() => null);
    const { ids, markAll } = body;

    // Opción A: Marcar todo como leído solo en la sucursal activa
    if (markAll) {
      await prisma.notification.updateMany({
        where: { sucursalId, read: false },
        data: {
          read: true,
          readAt: new Date(),
        },
      });
      return NextResponse.json({ success: true, message: "Todas leídas" });
    }

    // Opción B: Marcar algunas específicas (protegemos que sean de esta sucursal)
    if (ids && Array.isArray(ids) && ids.length > 0) {
      const normalizedIds = ids
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0);

      if (normalizedIds.length === 0) {
        return NextResponse.json({ error: "IDs invalidos" }, { status: 400 });
      }

      await prisma.notification.updateMany({
        where: { id: { in: normalizedIds }, sucursalId },
        data: {
          read: true,
          readAt: new Date(),
        },
      });
      return NextResponse.json({ success: true, message: "Actualizadas" });
    }

    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  } catch (error) {
    console.error("Error updating notifications:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
