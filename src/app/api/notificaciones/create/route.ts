import { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth"; // 🔒 Seguridad
import { z } from "zod";

const createNotificationSchema = z.object({
  type: z.nativeEnum(NotificationType),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  productoId: z.coerce.number().int().positive().optional(),
  fingerprint: z.string().trim().min(1).optional(),
});

export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const body = await req.json().catch(() => null);
    const parsed = createNotificationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validacion fallida", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const sucursalId = auth.activeSucursalId;
    const fingerprint =
      parsed.data.fingerprint ||
      `${parsed.data.type}:${parsed.data.productoId ?? "SYSTEM"}:S${sucursalId}`;

    const notification = await prisma.notification.upsert({
      where: {
        fingerprint: fingerprint,
      },
      // A) Si EXISTE: La actualizamos para que parezca nueva
      update: {
        updatedAt: new Date(),
        read: false,
        type: parsed.data.type,
        title: parsed.data.title,
        description: parsed.data.description || "",
        productoId: parsed.data.productoId ?? null,
      },
      // B) Si NO EXISTE: La creamos con la sucursal activa
      create: {
        type: parsed.data.type,
        title: parsed.data.title,
        description: parsed.data.description || "",
        productoId: parsed.data.productoId ?? null,
        fingerprint: fingerprint,
        sucursalId,
        read: false,
      },
    });

    return NextResponse.json({ success: true, notification });
  } catch (error) {
    console.error("❌ Error creando notificación:", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        { error: "El Producto ID referido no existe." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Error al crear la notificación" },
      { status: 500 },
    );
  }
}
