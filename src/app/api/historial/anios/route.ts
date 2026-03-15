//src/app/api/historial/anios/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { buildSucursalWhere } from "@/lib/sucursalScope";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const sucursalWhere = buildSucursalWhere(auth);
    const movimientos = await prisma.movimientoStock.findMany({
      where: sucursalWhere,
      select: { createdAt: true },
      distinct: ["createdAt"],
      orderBy: { createdAt: "desc" },
    });

    const yearsSet = new Set<number>();

    for (const mov of movimientos) {
      yearsSet.add(new Date(mov.createdAt).getFullYear());
    }

    const years = Array.from(yearsSet).sort((a, b) => b - a);

    if (years.length === 0) {
      years.push(new Date().getFullYear());
    }

    return NextResponse.json(years);
  } catch (error) {
    console.error("Error al obtener años del historial:", error);

    return NextResponse.json([new Date().getFullYear()], { status: 200 });
  }
}
