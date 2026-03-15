import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  getOrCreateHistorialShareUrl,
  isValidHistorialPeriod,
  parseHistorialPeriod,
} from "@/lib/historial-share-links";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const { id } = await params;
    const period = parseHistorialPeriod(id, req.url);

    if (!Number.isFinite(period.mes) || period.mes < 0 || period.mes > 11) {
      return NextResponse.json({ error: "Mes invalido (debe ser 0..11)" }, { status: 400 });
    }

    if (!Number.isFinite(period.anio) || period.anio < 2000 || period.anio > 2100) {
      return NextResponse.json({ error: "Ano invalido" }, { status: 400 });
    }

    if (!isValidHistorialPeriod(period)) {
      return NextResponse.json({ error: "Periodo invalido" }, { status: 400 });
    }

    const url = await getOrCreateHistorialShareUrl({
      ...period,
      sucursalId: auth.activeSucursalId,
    });

    return NextResponse.json({ url });
  } catch (error) {
    console.error("HISTORIAL_INVENTARIO SHARELINK ERROR:", error);
    return NextResponse.json({ error: "Error de servidor" }, { status: 500 });
  }
}
