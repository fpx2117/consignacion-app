import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessSucursalId,
  isGlobalSucursalView,
  resolveEffectiveSucursalContext,
  resolveRequestedSucursalId,
} from "@/lib/sucursalScope";

test("resolveEffectiveSucursalContext ignora x-sucursal-id malicioso para EMPLEADO", () => {
  const resolved = resolveEffectiveSucursalContext({
    user: { rol: "EMPLEADO", sucursalId: 10 },
    allowedSucursalIds: [10],
    cookieSucursalId: "20",
    jwtSucursalId: 10,
    clientRequestedSucursalId: "20",
  });

  assert.deepEqual(resolved, {
    activeSucursalId: 10,
    allowedSucursalIds: [10],
    ignoredClientSucursalId: 20,
    isGlobalView: false,
    source: "jwt",
  });
});

test("resolveEffectiveSucursalContext permite vista global explicita para ADMIN", () => {
  const resolved = resolveEffectiveSucursalContext({
    user: { rol: "ADMIN", sucursalId: null },
    allowedSucursalIds: [2, 5],
    cookieSucursalId: "0",
    jwtSucursalId: null,
    clientRequestedSucursalId: "5",
  });

  assert.deepEqual(resolved, {
    activeSucursalId: 0,
    allowedSucursalIds: [2, 5],
    ignoredClientSucursalId: 5,
    isGlobalView: true,
    source: "cookie",
  });
});

test("resolveEffectiveSucursalContext cae a sucursal permitida cuando la cookie es invalida", () => {
  const resolved = resolveEffectiveSucursalContext({
    user: { rol: "ADMIN", sucursalId: null },
    allowedSucursalIds: [4, 7],
    cookieSucursalId: "999",
    jwtSucursalId: null,
  });

  assert.deepEqual(resolved, {
    activeSucursalId: 4,
    allowedSucursalIds: [4, 7],
    ignoredClientSucursalId: null,
    isGlobalView: false,
    source: "default",
  });
});

test("resolveRequestedSucursalId solo acepta overrides dentro del permiso real", () => {
  const adminAuth = {
    user: { rol: "ADMIN", sucursalId: null },
    activeSucursalId: 2,
    allowedSucursalIds: [2, 5],
  };

  const empleadoAuth = {
    user: { rol: "EMPLEADO", sucursalId: 10 },
    activeSucursalId: 10,
    allowedSucursalIds: [10],
  };

  assert.equal(resolveRequestedSucursalId(adminAuth, 5), 5);
  assert.equal(resolveRequestedSucursalId(adminAuth, 0), 0);
  assert.equal(resolveRequestedSucursalId(adminAuth, 999), 2);
  assert.equal(resolveRequestedSucursalId(empleadoAuth, 20), 10);
});

test("canAccessSucursalId e isGlobalSucursalView respetan la politica explicita", () => {
  const globalAdminAuth = {
    user: { rol: "ADMIN", sucursalId: null },
    activeSucursalId: 0,
    allowedSucursalIds: [3, 8],
  };

  assert.equal(canAccessSucursalId(globalAdminAuth, 0), true);
  assert.equal(canAccessSucursalId(globalAdminAuth, 8), true);
  assert.equal(canAccessSucursalId(globalAdminAuth, 99), false);
  assert.equal(isGlobalSucursalView(globalAdminAuth), true);
});
