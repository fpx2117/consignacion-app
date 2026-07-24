import { test } from "node:test";
import assert from "node:assert/strict";

import { digitosAMonto, formatearInputMonto } from "./money-input.ts";

test("digitosAMonto mantiene mascara decimal por centavos", () => {
  assert.equal(digitosAMonto("1"), 0.01);
  assert.equal(digitosAMonto("1234"), 12.34);
  assert.equal(digitosAMonto("2000000"), 20000);
});

test("formatearInputMonto usa formato argentino con miles y coma decimal", () => {
  assert.equal(formatearInputMonto(0.01), "0,01");
  assert.equal(formatearInputMonto(12.34), "12,34");
  assert.equal(formatearInputMonto(20000), "20.000,00");
});
