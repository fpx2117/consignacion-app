import assert from "node:assert/strict";
import test from "node:test";
import { findSecretShapesInText } from "./tracked-secret-files.mjs";

test("detecta literales asignados a claves sensibles", () => {
  const key = ["JWT", "SECRET"].join("_");
  const value = ["a-real-looking", "secret-value", "123456"].join("-");
  const findings = findSecretShapesInText(
    `const config = { ${key}: "${value}" };`,
  );
  assert.equal(findings.length, 1);
  assert.equal(
    findSecretShapesInText(`${key}=another-real-secret-value-654321`).length,
    1,
  );
});

test("permite referencias de entorno y placeholders", () => {
  const key = ["JWT", "SECRET"].join("_");
  assert.deepEqual(
    findSecretShapesInText(
      `const secret = process.env.${key};\n${key}="change-me-local-dev";`,
    ),
    [],
  );
});
