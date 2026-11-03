// src/modules/consignaciones/units.ts
// Unidades de una consignación: pendientes y validación de liquidación.
//
// La fórmula `entregadas - vendidas - devueltas` estaba repetida en diez lugares
// (rutas, dashboard, PDF y UI) antes de T17. Acá vive una sola vez.
//
// Funciones puras: no tocan Prisma, no leen configuración, no redondean. Los
// acumulados son enteros en el esquema; se preserva el signo para que un estado
// inconsistente se vea como tal en lugar de esconderse.

export type ConsignmentCounters = {
  unitsEntregadas: number;
  unitsVendidasAcum: number;
  unitsDevueltasAcum: number;
};

/** Unidades todavía disponibles para vender o devolver. Puede ser negativo si el
 * estado persistido ya es inconsistente: el llamador decide cómo tratarlo. */
export function calculatePendingUnits(counters: ConsignmentCounters): number {
  return (
    counters.unitsEntregadas -
    counters.unitsVendidasAcum -
    counters.unitsDevueltasAcum
  );
}

export type SettlementRequest = ConsignmentCounters & {
  unitsVendidas: number;
  unitsDevueltas: number;
};

export type SettlementValidation =
  | { ok: true; pending: number; requested: number; remaining: number }
  | {
      ok: false;
      reason: "EXCEDE_PENDIENTE";
      pending: number;
      requested: number;
    };

/**
 * Valida que una liquidación no consuma más unidades de las pendientes.
 * Devuelve un resultado explícito en lugar de lanzar: el adaptador decide el
 * código HTTP o el error de dominio.
 */
export function validateSettlement(
  request: SettlementRequest,
): SettlementValidation {
  const pending = calculatePendingUnits(request);
  const requested = request.unitsVendidas + request.unitsDevueltas;

  if (requested > pending) {
    return { ok: false, reason: "EXCEDE_PENDIENTE", pending, requested };
  }

  return { ok: true, pending, requested, remaining: pending - requested };
}
