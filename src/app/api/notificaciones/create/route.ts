/* eslint-disable */
// @ts-nocheck
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth"; // 🔒 Seguridad
import { NOTIFICATION_TYPE } from "@/lib/notificationes/notificaciones-types"; // Opcional: para validar tipos

export async function POST(req: Request) {
  try {
    // 1. Seguridad: Solo usuarios autenticados (o un API Key si es un servicio externo)
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const body = await req.json();

    // 2. Validaciones
    if (!body.type || !body.title) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios (type, title)" },
        { status: 400 }
      );
    }

    // Generar fingerprint automático si no viene (Fallback de seguridad)
    // Ej: "LOW_STOCK:PROD_123"
    const fingerprint = body.fingerprint || `${body.type}:${body.productoId || 'SYSTEM'}`;

    // 3. LOGICA INTELIGENTE (Upsert)
    // Si ya existe la notificación, la revivimos (update). Si no, la creamos.
    const notification = await prisma.notification.upsert({
      where: {
        fingerprint: fingerprint, // Buscamos por la clave única
      },
      // A) Si EXISTE: La actualizamos para que parezca nueva
      update: {
        updatedAt: new Date(), // Sube al tope de la lista
        read: false,           // Vuelve a marcarse como no leída (enciende el foco rojo)
        description: body.description || undefined, // Actualiza descripción si cambió
        title: body.title,     // Actualiza título
      },
      // B) Si NO EXISTE: La creamos de cero
      create: {
        type: body.type, // Asegúrate de que coincida con el Enum NotificationType
        title: body.title,
        description: body.description || "",
        productoId: body.productoId ? Number(body.productoId) : null,
        fingerprint: fingerprint,
        read: false,
      },
    });

    return NextResponse.json({ success: true, notification });

  } catch (error: any) {
    console.error("❌ Error creando notificación:", error);

    // Error de clave foránea (Producto no existe)
    if (error.code === 'P2003') {
       return NextResponse.json({ error: "El Producto ID referido no existe." }, { status: 400 });
    }

    // Error de tipo Enum inválido (Si mandas un type que no está en el schema)
    if (error.message.includes("Argument 'type'")) {
        return NextResponse.json({ error: "El tipo de notificación no es válido." }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Error interno", details: error.message },
      { status: 500 }
    );
  }
}