/* eslint-disable */
// @ts-nocheck
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth"; // 🔒 Importante

export async function PATCH(req: Request) {
  try {
    // 1. Seguridad: Solo usuarios logueados pueden hacer esto
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    // 2. Ejecutamos la actualización GLOBAL
    // Como las notificaciones son de sistema (Stock, Vencimientos), 
    // "Leer todo" significa limpiar la bandeja para todos.
    const result = await prisma.notification.updateMany({
      where: { 
        read: false // Solo actualizamos las que no están leídas
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({ 
      success: true, 
      count: result.count,
      message: `Se marcaron ${result.count} notificaciones como leídas.`
    });

  } catch (error) {
    console.error("Error marking all as read:", error);
    return NextResponse.json(
      { error: "Error interno al marcar como leídas" },
      { status: 500 }
    );
  }
}