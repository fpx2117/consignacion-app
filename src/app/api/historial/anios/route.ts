import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Buscamos todas las fechas de creación en MovimientoStock
    // Usamos select para traer SOLO la fecha y no toda la data (más rápido)
    const movimientos = await prisma.movimientoStock.findMany({
      select: {
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 2. Extraemos los años únicos usando un Set
    const yearsSet = new Set<number>();
    
    movimientos.forEach((mov) => {
      const year = new Date(mov.createdAt).getFullYear();
      yearsSet.add(year);
    });

    // 3. Convertimos a array y ordenamos descendente (2026, 2025...)
    const years = Array.from(yearsSet).sort((a, b) => b - a);

    // Si no hay movimientos aún, devolvemos el año actual por defecto
    if (years.length === 0) {
      years.push(new Date().getFullYear());
    }

    return NextResponse.json(years);

  } catch (error) {
    console.error("Error al obtener años del historial:", error);
    // Fallback: devolver año actual si falla la BD
    return NextResponse.json([new Date().getFullYear()]);
  }
}