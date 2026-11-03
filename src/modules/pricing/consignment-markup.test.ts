import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { applyConsignmentMarkup } from "./consignment-markup";

test("el recargo de consignación reproduce la fórmula vigente", () => {
  const prices = [0, 1, 99.99, 1500.5, 123456.78];
  const percentages = [undefined, null, 0, 10, 21, 7.5, 100, -5];

  for (const basePrice of prices) {
    for (const percentage of percentages) {
      // Expresión literal que ejecutaban el carrito y la creación de
      // consignaciones antes de la extracción.
      const surcharge = Number(percentage) || 0;
      const expected = basePrice * (1 + surcharge / 100);
      assert.ok(
        Object.is(applyConsignmentMarkup(basePrice, percentage), expected),
        `base=${basePrice} pct=${percentage}`,
      );
    }
  }
});

test("casos documentados del recargo", () => {
  assert.equal(applyConsignmentMarkup(100, 0), 100);
  assert.equal(applyConsignmentMarkup(100, 25), 125);
  assert.equal(applyConsignmentMarkup(1000, 100), 2000);
  assert.equal(applyConsignmentMarkup(100, undefined), 100);
  assert.equal(applyConsignmentMarkup(100, null), 100);
  assert.equal(applyConsignmentMarkup(100, Number.NaN), 100);
  // El margen negativo no se recorta: es configuración, no dominio.
  assert.equal(applyConsignmentMarkup(100, -25), 75);
  // 10% no es exacto en binario. El artefacto de coma flotante se preserva a
  // propósito: unificarlo es una decisión de redondeo, no parte de T17.
  assert.equal(applyConsignmentMarkup(100, 10), 110.00000000000001);
});

test("el módulo se mantiene puro", async () => {
  const source = await readFile(
    resolve("src/modules/pricing/consignment-markup.ts"),
    "utf8",
  );
  assert.doesNotMatch(source, /@prisma|\bprisma\.|new Date\(|Date\.now\(/);
  assert.doesNotMatch(source, /process\.env|Math\.round|toFixed|console\./);
});
