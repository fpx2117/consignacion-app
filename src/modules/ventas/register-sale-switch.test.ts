import assert from "node:assert/strict";
import test from "node:test";

import {
  REGISTER_SALE_USE_CASE_ENV,
  readRegisterSaleUseCase,
  resolveRegisterSaleUseCase,
} from "@/modules/ventas/register-sale-switch";

test("el switch del piloto resuelve sólo con el valor exacto", async (t) => {
  await t.test("ausente selecciona legacy con diagnóstico", () => {
    const selection = resolveRegisterSaleUseCase(undefined);
    assert.equal(selection.name, "legacy");
    assert.match(selection.diagnostic ?? "", /is not set/);
  });

  await t.test("vacío selecciona legacy con diagnóstico", () => {
    const selection = resolveRegisterSaleUseCase("");
    assert.equal(selection.name, "legacy");
    assert.match(selection.diagnostic ?? "", /is empty/);
  });

  await t.test("un valor inválido selecciona legacy y lo reporta", () => {
    const selection = resolveRegisterSaleUseCase("Application");
    assert.equal(selection.name, "legacy");
    assert.match(selection.diagnostic ?? "", /has an invalid value/);
    assert.match(selection.diagnostic ?? "", /Application/);
  });

  await t.test("legacy explícito no genera diagnóstico", () => {
    assert.deepEqual(resolveRegisterSaleUseCase("legacy"), {
      name: "legacy",
      diagnostic: null,
    });
  });

  await t.test("application habilita la ruta nueva", () => {
    assert.deepEqual(resolveRegisterSaleUseCase("application"), {
      name: "application",
      diagnostic: null,
    });
  });

  await t.test("el diagnóstico se emite una sola vez por proceso", () => {
    const warn = t.mock.method(console, "warn", () => undefined);
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      [REGISTER_SALE_USE_CASE_ENV]: "t18-invalid-value",
    };

    assert.equal(readRegisterSaleUseCase(env).name, "legacy");
    assert.equal(readRegisterSaleUseCase(env).name, "legacy");
    assert.equal(warn.mock.callCount(), 1);
  });
});
