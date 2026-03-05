/* eslint-disable */
// @ts-nocheck
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth"; // 🔒 Importante

export async function PATCH(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const sucursalId = auth.activeSucursalId;

    // Marcamos como leídas solo las notificaciones de esta sucursal
    const result = await prisma.notification.updateMany({
      where: {
        sucursalId,
        read: false,
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