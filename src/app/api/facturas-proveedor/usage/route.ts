// src/app/api/facturas-proveedor/usage/route.ts
// Devuelve el consumo mensual de escaneos OCR de factura del plan activo, para
// pintar el contador "Escaneos usados este mes X / Y" en el dialog de carga.

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { checkFacturaOcrLimit } from "@/lib/subscriptions/require-subscription";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  try {
    const result = await checkFacturaOcrLimit();
    return NextResponse.json({
      data: {
        used: result.used,
        limit: result.limit,
        allowed: result.allowed,
        hasFeature: result.hasFeature,
      },
    });
  } catch (err) {
    console.error("[FACTURA_PROVEEDOR_USAGE_ERROR]", err);
    return NextResponse.json(
      { error: "Error al obtener el consumo de escaneos" },
      { status: 500 },
    );
  }
}
