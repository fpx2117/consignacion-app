//src/app/api/historial/anios/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { buildSucursalWhere } from "@/lib/sucursalScope";
import { nowAR } from "@/lib/utils-date";
import { resolveTimezoneForAuth } from "@/lib/get-configured-tz";

function getYearInTimezone(date: Date, tz: string) {
  return Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
    }).format(date),
  );
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HistorialAniosRouteDeps = {
  requireAuth: typeof requireAuth;
  resolveTimezoneForAuth: typeof resolveTimezoneForAuth;
  buildSucursalWhere: typeof buildSucursalWhere;
  findMovimientos: (where: ReturnType<typeof buildSucursalWhere>) => Promise<Array<{ createdAt: Date }>>;
  nowAR: typeof nowAR;
};

const defaultDeps: HistorialAniosRouteDeps = {
  requireAuth,
  resolveTimezoneForAuth,
  buildSucursalWhere,
  findMovimientos: (where) =>
    prisma.movimientoStock.findMany({
      where,
      select: { createdAt: true },
      distinct: ["createdAt"],
      orderBy: { createdAt: "desc" },
    }),
  nowAR,
};

export async function handleGetHistorialYears(deps: HistorialAniosRouteDeps = defaultDeps) {
  const auth = await deps.requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const timezone = await deps.resolveTimezoneForAuth(auth);
    const sucursalWhere = deps.buildSucursalWhere(auth);
    const movimientos = await deps.findMovimientos(sucursalWhere);

    const yearsSet = new Set<number>();

    for (const mov of movimientos) {
      yearsSet.add(getYearInTimezone(mov.createdAt, timezone.tz));
    }

    const years = Array.from(yearsSet).sort((a, b) => b - a);

    if (years.length === 0) {
      years.push(getYearInTimezone(deps.nowAR(timezone.tz), timezone.tz));
    }

    return NextResponse.json(years);
  } catch (error) {
    console.error("Error al obtener años del historial:", error);

    const timezone = await deps.resolveTimezoneForAuth(auth);
    return NextResponse.json([getYearInTimezone(deps.nowAR(timezone.tz), timezone.tz)], { status: 200 });
  }
}

export async function GET() {
  return handleGetHistorialYears();
}
