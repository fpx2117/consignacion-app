import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedRole, parseEmail, parsePositiveId } from "./user-input";

test("rechaza IDs ambiguos y roles no permitidos", () => {
  assert.equal(parsePositiveId("1abc"), null);
  assert.equal(parsePositiveId(-1), null);
  assert.equal(isAllowedRole("SUPERADMIN"), false);
});

test("normaliza emails válidos y rechaza formatos inválidos", () => {
  assert.equal(parseEmail(" ADMIN@EXAMPLE.COM "), "admin@example.com");
  assert.equal(parseEmail("not-an-email"), null);
});
