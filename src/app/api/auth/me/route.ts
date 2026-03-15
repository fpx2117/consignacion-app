import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";

type SucursalPermitida = {
  id: number;
  nombre: string;
  esPrincipal: boolean;
  activa: boolean;
};

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const userId = Number(auth.user.sub);

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
        sucursalId: true,
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

    // Lógica de Sucursales permitidas
    let sucursalesPermitidas: SucursalPermitida[] = [];

    if (user.rol === "ADMIN") {
      // ADMIN siempre puede ver todas las sucursales activas para visualizarlas
      sucursalesPermitidas = await prisma.sucursal.findMany({
        where: { activa: true },
        select: { id: true, nombre: true, esPrincipal: true, activa: true },
        orderBy: { id: "asc" }
      });
    } else {
      // EMPLEADO -> solo ve su sucursal asignada (o la principal si no tiene)
      const empSucursalId = user.sucursalId || 1;
      sucursalesPermitidas = await prisma.sucursal.findMany({
        where: { id: empSucursalId },
        select: { id: true, nombre: true, esPrincipal: true, activa: true }
      });
    }

    return NextResponse.json({
      data: {
        ...user,
        sucursalesPermitidas
      }
    }, {
      status: 200,
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=90",
      },
    });
  } catch {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }
}
