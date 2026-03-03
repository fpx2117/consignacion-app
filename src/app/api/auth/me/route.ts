/* eslint-disable */
// @ts-nocheck
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
    let sucursalesPermitidas: { id: number; nombre: string; esPrincipal: boolean; activa: boolean }[] = [];
    const allowSucursales = user.subscription?.plan?.limits?.allowSucursales;

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
    }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }
}
