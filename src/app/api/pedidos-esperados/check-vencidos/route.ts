// src/app/api/pedidos-esperados/check-vencidos/route.ts
// POST: Chequea y actualiza pedidos vencidos (para cron o llamada interna)

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { checkAndUpdateVencidos } from "@/lib/pedidos-esperados";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/pedidos-esperados/check-vencidos
 * Busca todos los pedidos PROGRAMADO/POSTERGADO con fechaEsperada < now()
 * y los actualiza a VENCIDO.
 * Retorna { data: { actualizados: number, ids: number[] } }
 */
export async function POST() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    // Chequear TODAS las sucursales (undefined = sin filtro de sucursal)
    const resultado = await checkAndUpdateVencidos();

    return NextResponse.json({
      data: {
        actualizados: resultado.count,
        ids: resultado.ids,
      },
    });
  } catch (error) {
    console.error("Error al chequear pedidos vencidos:", error);
    return NextResponse.json(
      { error: "Error interno al chequear pedidos vencidos" },
      { status: 500 }
    );
  }
}
