import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  applyCardSurcharge,
  applyDiscount,
  calculateLineTotal,
  calculateSaleTotals,
} from "./sale-totals";

// Referencia transcrita literalmente de POST /api/ventas ANTES de la extracción
// (route.ts:322-377). Es la especificación: si el módulo puro se aparta una sola
// unidad de coma flotante, estos tests fallan.

function legacyLine(input: {
  unitPrice: number;
  units: number;
  manualDiscount?: number;
  catalogDiscountPerUnit?: number | null;
}) {
  let descuento = Number(input.manualDiscount || 0);
  if (descuento === 0) {
    if (input.catalogDiscountPerUnit != null) {
      descuento = input.catalogDiscountPerUnit * input.units;
    }
  }
  const subtotal = input.unitPrice * input.units - descuento;
  return { descuento, subtotal };
}

function legacySaleTotals(input: {
  lineSubtotals: readonly number[];
  globalDiscount?: number;
  metodoPago?: string;
  porcentajeInteres?: number;
}) {
  let totalVenta = 0;
  for (const subtotal of input.lineSubtotals) totalVenta += subtotal;

  const descGlobalFinal = Number(input.globalDiscount) || 0;
  let montoInteres = 0;
  const porcentajeInteres = Number(input.porcentajeInteres) || 0;

  if (input.metodoPago === "TARJETA" && porcentajeInteres > 0) {
    montoInteres = (totalVenta - descGlobalFinal) * (porcentajeInteres / 100);
  }

  return {
    totalVenta,
    descGlobalFinal,
    montoInteres,
    totalFinal: totalVenta - descGlobalFinal + montoInteres,
  };
}

test("line totals match the legacy arithmetic exactly", () => {
  const prices = [0, 0.01, 1, 99.99, 1500.5, 123456.78];
  const unitCounts = [1, 2, 3, 7];
  const manualDiscounts = [undefined, 0, 0.5, 10, 99999];
  const catalogDiscounts = [null, 0, 3.3333, 15];

  let cases = 0;
  for (const unitPrice of prices) {
    for (const units of unitCounts) {
      for (const manualDiscount of manualDiscounts) {
        for (const catalogDiscountPerUnit of catalogDiscounts) {
          const expected = legacyLine({
            unitPrice,
            units,
            manualDiscount,
            catalogDiscountPerUnit,
          });
          const actual = calculateLineTotal({
            unitPrice,
            units,
            manualDiscount,
            catalogDiscountPerUnit,
          });
          assert.ok(
            Object.is(actual.discount, expected.descuento),
            `discount drift for ${JSON.stringify({ unitPrice, units, manualDiscount, catalogDiscountPerUnit })}`,
          );
          assert.ok(
            Object.is(actual.subtotal, expected.subtotal),
            `subtotal drift for ${JSON.stringify({ unitPrice, units, manualDiscount, catalogDiscountPerUnit })}`,
          );
          assert.equal(actual.unitPrice, unitPrice);
          assert.equal(actual.units, units);
          cases += 1;
        }
      }
    }
  }
  assert.equal(cases, 480);
});

test("sale totals match the legacy arithmetic exactly", () => {
  const carts = [
    [0],
    [1],
    [0.1, 0.2],
    [99.99, 0.01, 1500.5],
    [1500.5 * 2 - 300.1, 7 * 3.3333],
  ];
  const globalDiscounts = [undefined, 0, 0.01, 500, 1e6];
  const methods = ["TARJETA", "EFECTIVO", undefined];
  const percentages = [undefined, 0, 7.5, 21, 100];

  let cases = 0;
  for (const lineSubtotals of carts) {
    for (const globalDiscount of globalDiscounts) {
      for (const metodoPago of methods) {
        for (const porcentajeInteres of percentages) {
          const expected = legacySaleTotals({
            lineSubtotals,
            globalDiscount,
            metodoPago,
            porcentajeInteres,
          });
          const actual = calculateSaleTotals({
            lineSubtotals,
            globalDiscount,
            appliesCardSurcharge: metodoPago === "TARJETA",
            cardSurchargePercentage: porcentajeInteres,
          });
          const label = JSON.stringify({
            lineSubtotals,
            globalDiscount,
            metodoPago,
            porcentajeInteres,
          });
          assert.ok(
            Object.is(actual.subtotal, expected.totalVenta),
            `subtotal drift for ${label}`,
          );
          assert.ok(
            Object.is(actual.globalDiscount, expected.descGlobalFinal),
            `global discount drift for ${label}`,
          );
          assert.ok(
            Object.is(actual.surcharge, expected.montoInteres),
            `surcharge drift for ${label}`,
          );
          assert.ok(
            Object.is(actual.total, expected.totalFinal),
            `total drift for ${label}`,
          );
          cases += 1;
        }
      }
    }
  }
  assert.equal(cases, 375);
});

test("documented sale scenarios keep their observable numbers", () => {
  // Valores exactamente representables: el caso feliz se puede fijar a mano.
  const line = calculateLineTotal({
    unitPrice: 4,
    units: 3,
    manualDiscount: 0.5,
  });
  assert.deepEqual(line, {
    unitPrice: 4,
    units: 3,
    discount: 0.5,
    subtotal: 11.5,
  });

  const totals = calculateSaleTotals({
    lineSubtotals: [line.subtotal, 2],
    globalDiscount: 1,
    appliesCardSurcharge: true,
    cardSurchargePercentage: 25,
  });
  assert.deepEqual(totals, {
    subtotal: 13.5,
    globalDiscount: 1,
    surcharge: 3.125,
    total: 15.625,
  });

  // El manual gana al de catálogo; sin manual, el de catálogo se multiplica.
  assert.equal(
    applyDiscount({
      unitPrice: 100,
      units: 2,
      manualDiscount: 5,
      catalogDiscountPerUnit: 10,
    }),
    5,
  );
  assert.equal(
    applyDiscount({
      unitPrice: 100,
      units: 2,
      manualDiscount: 0,
      catalogDiscountPerUnit: 10,
    }),
    20,
  );
  assert.equal(
    applyDiscount({ unitPrice: 100, units: 2, catalogDiscountPerUnit: null }),
    0,
  );

  // Un descuento global mayor al subtotal deja total negativo: es el
  // comportamiento vigente y este refactor no lo corrige (ADR 003).
  assert.equal(
    calculateSaleTotals({
      lineSubtotals: [10],
      globalDiscount: 15,
      appliesCardSurcharge: false,
    }).total,
    -5,
  );

  // El recargo sólo aplica a tarjeta y con tasa positiva.
  assert.equal(
    applyCardSurcharge({
      amount: 100,
      appliesCardSurcharge: false,
      cardSurchargePercentage: 21,
    }),
    0,
  );
  assert.equal(
    applyCardSurcharge({
      amount: 100,
      appliesCardSurcharge: true,
      cardSurchargePercentage: 0,
    }),
    0,
  );
});

test("the module stays pure", async () => {
  const source = await readFile(
    resolve("src/modules/ventas/sale-totals.ts"),
    "utf8",
  );
  assert.doesNotMatch(source, /@prisma|PrismaClient|\bprisma\./);
  assert.doesNotMatch(source, /new Date\(|Date\.now\(|Math\.random\(/);
  assert.doesNotMatch(source, /process\.env|Math\.round|toFixed/);
});
