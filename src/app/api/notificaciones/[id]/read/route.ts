//src/app/api/notificaciones/[id]/read/route.ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth/require-auth";
import { isGlobalSucursalView } from "@/lib/sucursalScope";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(
  _req: Request,
  { params }: RouteContext
) {
  // Auth: Requiere usuario autenticado
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (isGlobalSucursalView(auth)) {
    return NextResponse.json({ error: "Vista global en modo solo lectura. Selecciona una sucursal para actualizar notificaciones." }, { status: 409 });
  }

  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const existingNotification = await prisma.notification.findFirst({
      where: { id, sucursalId: auth.activeSucursalId },
      select: { id: true },
    });

    if (!existingNotification) {
      return NextResponse.json(
        { error: "La notificación no existe o no pertenece a la sucursal activa" },
        { status: 404 }
      );
    }

    const notification = await prisma.notification.update({
      where: { id },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, notification });

  } catch (error) {
    console.error("Error al marcar notificación:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json(
        { error: "La notificación no existe o ya fue eliminada" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
