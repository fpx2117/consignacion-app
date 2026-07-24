import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { getDashboardTendencia } from "@/lib/dashboard/kpi-logic";
import { DashboardPeriod } from "@/lib/types";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") as DashboardPeriod) ?? "month";
  const sucursalId = auth.activeSucursalId;
  const isAdmin = auth.user.rol === "ADMIN";
  const userId = Number(auth.user.sub);

  try {
    const data = await getDashboardTendencia(
      sucursalId,
      period,
      isAdmin,
      Number.isFinite(userId) ? userId : undefined,
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
    console.error("Tendencia API Error:", error);
    return NextResponse.json(
      { error: "Error al obtener datos de tendencia" },
      { status: 500 },
    );
  }
}
