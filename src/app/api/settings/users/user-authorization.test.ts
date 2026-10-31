import assert from "node:assert/strict";
import test from "node:test";
import {
  canChangeOwnRole,
  canManageSucursal,
  getUserAccessError,
} from "./user-authorization";

const scope = { allowedSucursalIds: [1, 2], isGlobalView: false };

test("limita alcance y evita auto-degradación", () => {
  assert.equal(canManageSucursal(2, [1, 2], false), true);
  assert.equal(canManageSucursal(3, [1, 2], false), false);
  assert.equal(canManageSucursal(null, [1, 2], false), false);
  assert.equal(canChangeOwnRole(1, 1, "EMPLEADO"), false);
  assert.equal(canChangeOwnRole(1, 1, "ADMIN"), true);
});

test("rechaza usuarios y reasignaciones fuera de las sucursales permitidas", async () => {
  const foreignUser = await getUserAccessError(7, scope, 1, async () => ({
    sucursalId: 3,
  }));
  assert.equal(foreignUser?.status, 403);

  const foreignAssignment = await getUserAccessError(
    7,
    scope,
    3,
    async () => ({ sucursalId: 1 }),
  );
  assert.equal(foreignAssignment?.status, 403);
});

test("distingue usuarios inexistentes de operaciones autorizadas", async () => {
  const missing = await getUserAccessError(7, scope, 1, async () => null);
  assert.equal(missing?.status, 404);

  const allowed = await getUserAccessError(7, scope, 2, async () => ({
    sucursalId: 1,
  }));
  assert.equal(allowed, null);
});
