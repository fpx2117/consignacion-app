import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";

type SucursalBody = {
  nombre?: string;
  activa?: boolean;
};

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json(
      { error: "Permisos insuficientes" },
      { status: 403 },
    );
  }

  const sucursales = await prisma.sucursal.findMany({
    orderBy: { id: "asc" },
  });

  return NextResponse.json({ data: sucursales });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json(
      { error: "Permisos insuficientes" },
      { status: 403 },
    );
  }

  try {
    const { nombre, activa } = (await req.json()) as SucursalBody;
    const nombreNormalizado = nombre?.trim();

    if (!nombreNormalizado) {
      return NextResponse.json(
        { error: "Nombre obligatorio" },
        { status: 400 },
      );
    }

    const nueva = await prisma.sucursal.create({
      data: {
        nombre: nombreNormalizado,
        activa: activa ?? true,
      },
    });

    return NextResponse.json({ data: nueva }, { status: 201 });
  } catch (error) {
    console.error("Error al crear la sucursal:", error);
    return NextResponse.json(
      { error: "Error al crear la sucursal" },
      { status: 500 },
    );
  }
}
