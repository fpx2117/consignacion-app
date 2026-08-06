import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { getDashboardTendencia } from "@/lib/dashboard/kpi-logic";
import {
  DashboardDateRangeError,
  parseDashboardDateQuery,
} from "@/lib/dashboard/date-range";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const sucursalId = auth.activeSucursalId;
  const isAdmin = auth.user.rol === "ADMIN";
  const userId = Number(auth.user.sub);

  try {
    const { period, range } = parseDashboardDateQuery(searchParams);
    if (period === "all") {
      return NextResponse.json(
        { error: "Historico no admite una serie de tendencia." },
        { status: 400 },
      );
    }
    const data = await getDashboardTendencia(
      sucursalId,
      period,
      isAdmin,
      Number.isFinite(userId) ? userId : undefined,
      range,
    );
    return NextResponse.json(
      { data },
      {
        headers: {
          "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
        },
      },
    );
  } catch (error: unknown) {
    if (error instanceof DashboardDateRangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Tendencia API Error:", error);
    return NextResponse.json(
      { error: "Error al obtener datos de tendencia" },
      { status: 500 },
    );
  }
}
