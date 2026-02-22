import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthTokenFromCookies, verifyUserJwt } from "@/lib/auth";

export async function GET() {
  const token = await getAuthTokenFromCookies();

  if (!token) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const payload = await verifyUserJwt(token);
    const userId = Number(payload.sub);

    if (!userId) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const user = await prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        createdAt: true,
        subscription: {
          include: {
            plan: {
              include: {
                limits: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.activo) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    return NextResponse.json({ data: user }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }
}
