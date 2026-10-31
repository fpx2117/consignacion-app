import assert from "node:assert/strict";
import test from "node:test";
import { canRemoveUser } from "./user-update";

test("protege al último administrador activo", () => {
  assert.equal(canRemoveUser("ADMIN", 1), false);
  assert.equal(canRemoveUser("ADMIN", 2), true);
  assert.equal(canRemoveUser("EMPLEADO", 1), true);
});
