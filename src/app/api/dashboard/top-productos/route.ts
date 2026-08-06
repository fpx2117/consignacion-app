import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { getDashboardTopProductos } from "@/lib/dashboard/kpi-logic";
import {
  DashboardDateRangeError,
  parseDashboardDateQuery,
} from "@/lib/dashboard/date-range";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 5) || 5, 50);
  const sucursalId = auth.activeSucursalId;
  const isAdmin = auth.user.rol === "ADMIN";
  const userId = Number(auth.user.sub);

  try {
    const { period, range } = parseDashboardDateQuery(searchParams);
    const data = await getDashboardTopProductos(
      sucursalId,
      period,
      isAdmin,
      limit,
      Number.isFinite(userId) ? userId : undefined,
      range,
    );
    return NextResponse.json(
      { data: { period, topVendidos: data } },
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
    console.error("Top Productos API Error:", error);
    return NextResponse.json(
      { error: "Error al obtener los productos más vendidos" },
      { status: 500 },
    );
  }
}
