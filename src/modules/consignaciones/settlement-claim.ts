// src/modules/consignaciones/settlement-claim.ts
// Reclamo condicional de unidades pendientes de una consignación.
//
// El patrón previo era: leer los acumulados, validar en memoria y después
// incrementar. Bajo READ COMMITTED dos liquidaciones concurrentes leen el mismo
// estado, ambas pasan la validación y ambas incrementan: la suma supera las
// unidades entregadas. Este módulo hace que la validación y el incremento sean
// una sola operación atómica: el UPDATE sólo afecta la fila si todavía quedan
// pendientes suficientes, y el segundo escritor espera el lock de fila y
// re-evalúa el predicado contra la versión confirmada.
//
// El adaptador Prisma es el único que conoce la tabla; el dominio sigue
// expresando la invariante con `validateSettlement`.

import type { Prisma } from "@prisma/client";

export type SettlementClaimInput = {
  consignacionDetalleId: number;
  unitsVendidas: number;
  unitsDevueltas: number;
};

function assertUnits(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Settlement ${label} must be a non-negative integer`);
  }
}

/**
 * Incrementa los acumulados del detalle si, y sólo si, el pendiente alcanza.
 * Devuelve `false` cuando otra liquidación consumió las unidades primero; el
 * llamador traduce a `EXCEDE_PENDIENTE` dentro de la misma transacción.
 */
export async function claimSettlementUnits(
  client: Prisma.TransactionClient,
  input: SettlementClaimInput,
): Promise<boolean> {
  assertUnits(input.unitsVendidas, "unitsVendidas");
  assertUnits(input.unitsDevueltas, "unitsDevueltas");

  const requested = input.unitsVendidas + input.unitsDevueltas;
  const affected = await client.$executeRaw`
    UPDATE public."ConsignacionDetalle"
    SET "unitsVendidasAcum" = "unitsVendidasAcum" + ${input.unitsVendidas},
        "unitsDevueltasAcum" = "unitsDevueltasAcum" + ${input.unitsDevueltas}
    WHERE "id" = ${input.consignacionDetalleId}
      AND (
        "unitsEntregadas" - "unitsVendidasAcum" - "unitsDevueltasAcum"
      ) >= ${requested}
  `;

  return affected === 1;
}
