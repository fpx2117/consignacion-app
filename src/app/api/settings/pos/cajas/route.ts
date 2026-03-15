import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";

type CreateCajaBody = {
  nombre?: string;
};

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const cajas = await prisma.caja.findMany({
      where: { activa: true, sucursalId: auth.activeSucursalId },
      orderBy: { id: "asc" },
    });
    return NextResponse.json({ data: cajas });
  } catch (error) {
    console.error("Error al obtener las cajas:", error);
    return NextResponse.json({ error: "Error al obtener las cajas" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json({ error: "Solo admin puede crear cajas." }, { status: 403 });
  }

  try {
    const { nombre } = (await req.json()) as CreateCajaBody;
    const nombreNormalizado = nombre?.trim();

    if (!nombreNormalizado) {
      return NextResponse.json({ error: "Nombre obligatorio." }, { status: 400 });
    }

    const nuevaCaja = await prisma.caja.create({
      data: { nombre: nombreNormalizado, activa: true, sucursalId: auth.activeSucursalId },
    });
    return NextResponse.json({ data: nuevaCaja });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ya existe." }, { status: 400 });
    }

    console.error("Error al crear la caja:", error);
    return NextResponse.json({ error: "Error al crear la caja" }, { status: 500 });
  }
}
