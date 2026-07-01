import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth"; // 🔒 Importante
import { isGlobalSucursalView } from "@/lib/security/sucursalScope";

export async function PATCH() {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (isGlobalSucursalView(auth)) {
      return NextResponse.json({ error: "Vista global en modo solo lectura. Selecciona una sucursal para actualizar notificaciones." }, { status: 409 });
    }

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
