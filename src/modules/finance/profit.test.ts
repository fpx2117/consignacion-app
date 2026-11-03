import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  calculateGrossProfit,
  calculateLineProfit,
  calculateMarginPercentage,
} from "./profit";

test("la ganancia de línea reproduce la aritmética vigente", () => {
  const subtotals = [0, 1, 99.99, 1500.5, 123456.78, -10];
  const unitCounts = [1, 2, 3, 7];
  const unitCosts = [0, 0.01, 50, 1234.56];

  for (const subtotal of subtotals) {
    for (const units of unitCounts) {
      for (const unitCost of unitCosts) {
        // Expresión literal que ejecutaban kpi-logic y los PDF.
        const expected = subtotal - unitCost * units;
        assert.ok(
          Object.is(
            calculateLineProfit({ subtotal, units, unitCost }),
            expected,
          ),
          `subtotal=${subtotal} units=${units} unitCost=${unitCost}`,
        );
      }
    }
  }
});

test("la ganancia bruta suma en orden y resta el descuento al final", () => {
  const carts = [
    [],
    [{ subtotal: 10, units: 1, unitCost: 4 }],
    [
      { subtotal: 30.01, units: 3, unitCost: 10.01 },
      { subtotal: 9.99, units: 2, unitCost: 5.55 },
    ],
    [
      { subtotal: 0.1, units: 1, unitCost: 0.2 },
      { subtotal: 0.2, units: 1, unitCost: 0 },
    ],
  ];
  const discounts = [undefined, null, 0, 0.01, 500, 1e6];

  for (const lines of carts) {
    for (const discount of discounts) {
      let expected = 0;
      for (const line of lines) {
        expected += line.subtotal - line.unitCost * line.units;
      }
      expected -= Number(discount) || 0;
      assert.ok(
        Object.is(calculateGrossProfit(lines, discount), expected),
        JSON.stringify({ lines, discount }),
      );
    }
  }

  // El descuento global puede dejar la ganancia negativa: se preserva.
  assert.equal(
    calculateGrossProfit([{ subtotal: 10, units: 1, unitCost: 4 }], 20),
    -14,
  );
  assert.equal(calculateGrossProfit([], 5), -5);
  assert.equal(calculateGrossProfit([], undefined), 0);
});

test("la ganancia bruta resta el descuento al final, no por línea", () => {
  // En coma flotante el orden importa: restar el descuento al final da un
  // resultado distinto que restarlo de la primera línea. El contrato elige el
  // primer orden, que es el histórico.
  const lines = [
    { subtotal: 0.1, units: 1, unitCost: 0 },
    { subtotal: 0.2, units: 1, unitCost: 0 },
  ];
  const alFinal = 0.1 + 0.2 - 0.3;
  const porLinea = 0.1 - 0.3 + 0.2;
  assert.notEqual(alFinal, porLinea);
  assert.ok(Object.is(calculateGrossProfit(lines, 0.3), alFinal));
  assert.ok(!Object.is(calculateGrossProfit(lines, 0.3), porLinea));
});

test("el margen conserva el cero en base no positiva", () => {
  assert.equal(calculateMarginPercentage({ profit: 25, base: 100 }), 25);
  assert.equal(calculateMarginPercentage({ profit: -25, base: 100 }), -25);
  assert.equal(calculateMarginPercentage({ profit: 0, base: 100 }), 0);
  assert.equal(calculateMarginPercentage({ profit: 10, base: 0 }), 0);
  assert.equal(calculateMarginPercentage({ profit: 10, base: -5 }), 0);

  // El reporte de POS redondea en su plantilla, no acá.
  assert.equal(
    Math.round(calculateMarginPercentage({ profit: 4299, base: 10000 })),
    43,
  );
  assert.equal(Math.round(calculateMarginPercentage({ profit: 1, base: 3 })), 33);
  assert.equal(
    Math.round(calculateMarginPercentage({ profit: 7, base: 100 })),
    7,
  );
});

test("el módulo se mantiene puro", async () => {
  const source = await readFile(resolve("src/modules/finance/profit.ts"), "utf8");
  assert.doesNotMatch(source, /@prisma|\bprisma\.|new Date\(|Date\.now\(/);
  assert.doesNotMatch(source, /process\.env|Math\.round|toFixed|console\./);
});
