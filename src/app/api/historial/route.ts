import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { buildSucursalWhere } from "@/lib/security/sucursalScope";
import { nowAR, monthRangeAR } from "@/lib/date-format/utils-date";
import { resolveTimezoneForAuth } from "@/lib/timezone/get-configured-tz";

function getMonthAndYearInTimezone(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);

  return {
    month: Number(parts.find((part) => part.type === "month")?.value) - 1,
    year: Number(parts.find((part) => part.type === "year")?.value),
  };
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const { searchParams } = new URL(req.url);
    const sucursalWhere = buildSucursalWhere(auth);

    const mesRaw = searchParams.get("mes");
    const anioRaw = searchParams.get("anio");

    const timezone = await resolveTimezoneForAuth(auth);
    const nowAr = nowAR(timezone.tz);
    const current = getMonthAndYearInTimezone(nowAr, timezone.tz);
    const mes = Number.parseInt(mesRaw ?? String(current.month), 10);
    const anio = Number.parseInt(anioRaw ?? String(current.year), 10);

    if (!Number.isFinite(mes) || mes < 0 || mes > 11) {
      return NextResponse.json(
        { error: "Mes inválido (debe ser 0..11)" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(anio) || anio < 2000 || anio > 2100) {
      return NextResponse.json({ error: "Año inválido" }, { status: 400 });
    }

    const { start: fechaInicio, end: fechaFin } = monthRangeAR(
      anio,
      mes,
      timezone.tz,
    );

    const movimientos = await prisma.movimientoStock.findMany({
      where: {
        ...sucursalWhere,
        createdAt: { gte: fechaInicio, lte: fechaFin },
      },
      include: {
        producto: { select: { nombre: true, codigoBarra: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(movimientos);
  } catch (error) {
    console.error("HISTORIAL INVENTARIO API ERROR:", error);
    return NextResponse.json(
      { error: "Error al obtener historial" },
      { status: 500 },
    );
  }
}
