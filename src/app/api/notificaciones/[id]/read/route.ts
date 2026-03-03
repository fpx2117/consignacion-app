/* eslint-disable */
// @ts-nocheck

//src/app/api/notificaciones/[id]/read/route.ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(
  req: Request,
  { params }: RouteContext
) {
  try {
    const { id: rawId } = await params;
    
    // ⚠️ ATENCIÓN: Solo usa Number() si tu ID en schema.prisma es Int.
    // Si es String (uuid/cuid), borra estas 3 líneas y usa rawId directamente.
    const id = Number(rawId);
    if (isNaN(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const notification = await prisma.notification.update({
      where: { id }, // Si es String, asegúrate de pasar el string aquí
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, notification });

  } catch (error: any) {
    console.error("Error al marcar notificación:", error);

    // Prisma: P2025 significa "Record to update not found"
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: "La notificación no existe o ya fue eliminada" },
        { status: 404 }
      );
    }

    // Cualquier otro error es un problema interno (ej. DB caída)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}