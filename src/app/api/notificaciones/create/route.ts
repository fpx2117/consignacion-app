/* eslint-disable */
// @ts-nocheck
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth"; // 🔒 Seguridad
import { NOTIFICATION_TYPE } from "@/lib/notificationes/notificaciones-types";

export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const body = await req.json();

    if (!body.type || !body.title) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios (type, title)" },
        { status: 400 }
      );
    }

    const fingerprint = body.fingerprint || `${body.type}:${body.productoId || 'SYSTEM'}`;
    const sucursalId = auth.activeSucursalId;

    const notification = await prisma.notification.upsert({
      where: {
        fingerprint: fingerprint,
      },
      // A) Si EXISTE: La actualizamos para que parezca nueva
      update: {
        updatedAt: new Date(),
        read: false,
        description: body.description || undefined,
        title: body.title,
      },
      // B) Si NO EXISTE: La creamos con la sucursal activa
      create: {
        type: body.type,
        title: body.title,
        description: body.description || "",
        productoId: body.productoId ? Number(body.productoId) : null,
        fingerprint: fingerprint,
        sucursalId,
        read: false,
      },
    });

    return NextResponse.json({ success: true, notification });

  } catch (error: any) {
    console.error("❌ Error creando notificación:", error);

    if (error.code === 'P2003') {
      return NextResponse.json({ error: "El Producto ID referido no existe." }, { status: 400 });
    }

    if (error.message.includes("Argument 'type'")) {
      return NextResponse.json({ error: "El tipo de notificación no es válido." }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Error interno", details: error.message },
      { status: 500 }
    );
  }
}