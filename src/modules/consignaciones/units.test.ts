import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  calculatePendingUnits,
  validateSettlement,
} from "./units";

test("las unidades pendientes preservan la aritmética vigente", () => {
  const cases = [
    { unitsEntregadas: 5, unitsVendidasAcum: 0, unitsDevueltasAcum: 0 },
    { unitsEntregadas: 5, unitsVendidasAcum: 5, unitsDevueltasAcum: 0 },
    { unitsEntregadas: 5, unitsVendidasAcum: 3, unitsDevueltasAcum: 2 },
    { unitsEntregadas: 0, unitsVendidasAcum: 0, unitsDevueltasAcum: 0 },
    // Estado inconsistente: el exceso se ve, no se recorta a 0.
    { unitsEntregadas: 5, unitsVendidasAcum: 6, unitsDevueltasAcum: 0 },
    { unitsEntregadas: 1, unitsVendidasAcum: 0, unitsDevueltasAcum: 2 },
  ];

  for (const counters of cases) {
    const expected =
      counters.unitsEntregadas -
      counters.unitsVendidasAcum -
      counters.unitsDevueltasAcum;
    assert.ok(
      Object.is(calculatePendingUnits(counters), expected),
      JSON.stringify(counters),
    );
  }

  assert.equal(
    calculatePendingUnits({
      unitsEntregadas: 10,
      unitsVendidasAcum: 4,
      unitsDevueltasAcum: 1,
    }),
    5,
  );
});

test("la validación de liquidación acepta exacto y rechaza el exceso", () => {
  const base = {
    unitsEntregadas: 5,
    unitsVendidasAcum: 0,
    unitsDevueltasAcum: 0,
  };

  assert.deepEqual(
    validateSettlement({ ...base, unitsVendidas: 3, unitsDevueltas: 1 }),
    { ok: true, pending: 5, requested: 4, remaining: 1 },
  );

  // Consumir exactamente lo pendiente es válido y deja 0.
  assert.deepEqual(
    validateSettlement({ ...base, unitsVendidas: 4, unitsDevueltas: 1 }),
    { ok: true, pending: 5, requested: 5, remaining: 0 },
  );

  // Un solo excedente alcanza para rechazar.
  assert.deepEqual(
    validateSettlement({ ...base, unitsVendidas: 5, unitsDevueltas: 1 }),
    { ok: false, reason: "EXCEDE_PENDIENTE", pending: 5, requested: 6 },
  );
  assert.deepEqual(
    validateSettlement({ ...base, unitsVendidas: 0, unitsDevueltas: 6 }),
    { ok: false, reason: "EXCEDE_PENDIENTE", pending: 5, requested: 6 },
  );

  // Con pendiente 0, no se puede liquidar nada.
  assert.deepEqual(
    validateSettlement({
      unitsEntregadas: 5,
      unitsVendidasAcum: 5,
      unitsDevueltasAcum: 0,
      unitsVendidas: 1,
      unitsDevueltas: 0,
    }),
    { ok: false, reason: "EXCEDE_PENDIENTE", pending: 0, requested: 1 },
  );
  assert.deepEqual(
    validateSettlement({
      unitsEntregadas: 5,
      unitsVendidasAcum: 5,
      unitsDevueltasAcum: 0,
      unitsVendidas: 0,
      unitsDevueltas: 0,
    }),
    { ok: true, pending: 0, requested: 0, remaining: 0 },
  );

  // Devolución de todas las pendientes.
  assert.deepEqual(
    validateSettlement({ ...base, unitsVendidas: 0, unitsDevueltas: 5 }),
    { ok: true, pending: 5, requested: 5, remaining: 0 },
  );
});

test("las funciones se mantienen puras", async () => {
  const source = await readFile(
    resolve("src/modules/consignaciones/units.ts"),
    "utf8",
  );
  assert.doesNotMatch(source, /@prisma|\bprisma\.|new Date\(|Date\.now\(/);
  assert.doesNotMatch(source, /process\.env|Math\.round|toFixed|console\./);
});
