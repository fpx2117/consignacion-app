import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import { getDashboardTendencia } from "@/lib/kpi-logic";
import { DashboardPeriod } from "@/lib/types";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") as DashboardPeriod) ?? "month";
  const sucursalId = auth.activeSucursalId;
  const isAdmin = auth.user.rol === "ADMIN";

  try {
    const data = await getDashboardTendencia(sucursalId, period, isAdmin);
    return NextResponse.json({ data }, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    });
  } catch (error: any) {
    console.error("Tendencia API Error:", error);
    return NextResponse.json({ error: "Error al obtener datos de tendencia" }, { status: 500 });
  }
}
