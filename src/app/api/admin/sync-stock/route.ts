// src/app/api/admin/sync-stock/route.ts
// RETIRADO. Recalculaba Producto = SUM(StockSucursal) sin lock ni autoridad, así
// que podía pisar un delta en vuelo de cualquier writer de B1.
//
// La única reparación global válida es la compensación T14
// (scripts/migrations/compensate-t14-stock-authority.mjs), que bloquea la
// capacidad, toma StockSucursal y Producto en el orden fijo, reconcilia y exige
// deriva 0 antes de commitear. Esa compensación fuerza APP_DUAL_WRITE y retira el
// trigger de proyección: no debe ejecutarse con T16 activo (DB_PROJECTION).
//
// Este endpoint queda como guarda explícita: autentica y responde, pero no
// escribe stock.

import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";

const COMPENSATION_SCRIPT =
  "scripts/migrations/compensate-t14-stock-authority.mjs";

export async function POST() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json(
      { error: "Se requiere rol ADMIN" },
      { status: 403 },
    );
  }

  return NextResponse.json(
    {
      error: "sync-stock retirado",
      detalle:
        "La reparación global de stock ya no se ejecuta desde la API. Usá la compensación T14, que bloquea la autoridad y verifica deriva 0.",
      advertencia:
        "La compensación fuerza APP_DUAL_WRITE y retira el trigger de proyección: no la ejecutes con T16 activo (DB_PROJECTION).",
      comando: `node ${COMPENSATION_SCRIPT}`,
      variables: [
        "DATABASE_URL",
        "T14_CONFIRM_DATABASE (nombre exacto de la base)",
        "T14_ALLOW_PRODUCTION=true (solo producción)",
      ],
    },
    { status: 410 },
  );
}
