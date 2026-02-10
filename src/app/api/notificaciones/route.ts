
//src/app/api/notificaciones/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth"; // 🔒 Seguridad

// --- GET: Obtener lista y contador ---
export async function GET(req: Request) {
  try {
    // 1. Verificación de Seguridad
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const { searchParams } = new URL(req.url);
    const onlyUnread = searchParams.get("onlyUnread") === "true";
    const limit = Number(searchParams.get("limit") || 50);

    // 2. Query Principal
    const notifications = await prisma.notification.findMany({
      where: onlyUnread ? { read: false } : {},
      orderBy: { createdAt: "desc" }, // Las más nuevas primero
      take: limit,
      // Incluimos datos del producto para mostrar nombres en la alerta
      include: {
        producto: {
          select: { id: true, nombre: true }
        }
      }
    });

    // 3. Obtener contador total de no leídas (para el globito rojo 🔴)
    const unreadCount = await prisma.notification.count({
      where: { read: false }
    });

    return NextResponse.json({ 
      data: notifications, 
      unreadCount // Enviamos el contador separado
    });

  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Error interno al obtener notificaciones" },
      { status: 500 }
    );
  }
}

// --- PATCH: Marcar como Leídas ---
export async function PATCH(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const body = await req.json();
    const { ids, markAll } = body; // Esperamos { markAll: true } o { ids: [1, 2] }

    // Opción A: Marcar TODO como leído (botón "Marcar todo como leído")
    if (markAll) {
      await prisma.notification.updateMany({
        where: { read: false },
        data: { 
          read: true,
          readAt: new Date()
        }
      });
      return NextResponse.json({ success: true, message: "Todas leídas" });
    }

    // Opción B: Marcar algunas específicas (al hacer clic en una)
    if (ids && Array.isArray(ids) && ids.length > 0) {
      await prisma.notification.updateMany({
        where: { id: { in: ids } },
        data: { 
          read: true, 
          readAt: new Date() 
        }
      });
      return NextResponse.json({ success: true, message: "Actualizadas" });
    }

    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });

  } catch (error) {
    console.error("Error updating notifications:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}