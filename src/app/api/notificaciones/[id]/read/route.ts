import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Interfaz para cumplir con Next.js 15+
interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(
  req: Request,
  { params }: RouteContext
) {
  try {
    // Resolvemos la promesa de params
    const { id: rawId } = await params;
    const id = Number(rawId);

    if (isNaN(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
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
    return NextResponse.json(
      { error: "Notification not found" },
      { status: 404 }
    );
  }
}