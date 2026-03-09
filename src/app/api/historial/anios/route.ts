//src/app/api/historial/anios/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  // Auth: Requiere usuario autenticado
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    // ✅ Traemos solo fechas únicas (mucho más liviano)
    const movimientos = await prisma.movimientoStock.findMany({
      select: { createdAt: true },
      distinct: ["createdAt"],
      orderBy: { createdAt: "desc" },
    });

    // Extraemos años únicos
    const yearsSet = new Set<number>();

    for (const mov of movimientos) {
      yearsSet.add(new Date(mov.createdAt).getFullYear());
    }

    const years = Array.from(yearsSet).sort((a, b) => b - a);

    // Fallback si no hay movimientos
    if (years.length === 0) {
      years.push(new Date().getFullYear());
    }

    return NextResponse.json(years);
  } catch (error) {
    console.error("Error al obtener años del historial:", error);

    // Fallback seguro
    return NextResponse.json([new Date().getFullYear()], { status: 200 });
  }
}
