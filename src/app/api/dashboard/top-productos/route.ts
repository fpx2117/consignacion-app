import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import { getDashboardTopProductos } from "@/lib/kpi-logic";
import { DashboardPeriod } from "@/lib/types";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") as DashboardPeriod) ?? "month";
  const limit = Math.min(Number(searchParams.get("limit") ?? 5) || 5, 50);
  const sucursalId = auth.activeSucursalId;
  const isAdmin = auth.user.rol === "ADMIN";

  try {
    const data = await getDashboardTopProductos(sucursalId, period, isAdmin, limit);
    return NextResponse.json({ data: { period, topVendidos: data } }, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    });
  } catch (error: any) {
    console.error("Top Productos API Error:", error);
    return NextResponse.json({ error: "Error al obtener los productos más vendidos" }, { status: 500 });
  }
}
