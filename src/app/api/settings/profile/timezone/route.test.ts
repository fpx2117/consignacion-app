import assert from "node:assert/strict";
import test from "node:test";
import { handleGetProfileTimezone, handlePutProfileTimezone } from "@/app/api/settings/profile/timezone/route";
import { handleGetMe } from "@/app/api/auth/me/route";

const okAuth = {
  ok: true as const,
  user: {
    sub: "5",
    rol: "EMPLEADO" as const,
    email: "ana@example.com",
    nombre: "Ana",
    sucursalId: 2,
  },
  activeSucursalId: 2,
  allowedSucursalIds: [2],
  isGlobalView: false,
  token: "token",
};

const isValidTimezoneMock = (value: string | null | undefined): value is string => Boolean(value);
const isInvalidTimezoneMock = (_value: string | null | undefined): _value is string => false;

test("handleGetProfileTimezone devuelve timezone resuelta y origen", async () => {
  const response = await handleGetProfileTimezone({
    requireAuth: async () => okAuth,
    resolveTimezoneForAuth: async () => ({
      tz: "America/Bogota",
      source: "user",
      userId: 5,
      sucursalId: 2,
      zonaHorariaUsuario: "America/Bogota",
      zonaHorariaSucursal: "America/Santiago",
    }),
    updateUserTimezone: async () => undefined,
    isValidTimezone: isValidTimezoneMock,
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    data: {
      zonaHoraria: "America/Bogota",
      zonaHorariaSucursal: "America/Santiago",
      zonaHorariaResuelta: "America/Bogota",
      timezoneSource: "user",
    },
  });
});

test("handlePutProfileTimezone rechaza timezones IANA invalidas", async () => {
  let updated = false;

  const response = await handlePutProfileTimezone(new Request("http://localhost/api/settings/profile/timezone", {
    method: "PUT",
    body: JSON.stringify({ zonaHoraria: "Invalid/Timezone" }),
    headers: { "Content-Type": "application/json" },
  }), {
    requireAuth: async () => okAuth,
    resolveTimezoneForAuth: async () => ({
      tz: "America/Santiago",
      source: "branch",
      userId: 5,
      sucursalId: 2,
      zonaHorariaUsuario: null,
      zonaHorariaSucursal: "America/Santiago",
    }),
    updateUserTimezone: async () => {
      updated = true;
    },
    isValidTimezone: isInvalidTimezoneMock,
  });

  assert.equal(response.status, 400);
  assert.equal(updated, false);
  assert.match((await response.json()).error, /timezone IANA v[aá]lida/i);
});

test("handlePutProfileTimezone acepta null para volver a heredar sucursal", async () => {
  const updates: Array<{ userId: number; zonaHoraria: string | null }> = [];

  const response = await handlePutProfileTimezone(new Request("http://localhost/api/settings/profile/timezone", {
    method: "PUT",
    body: JSON.stringify({ zonaHoraria: null }),
    headers: { "Content-Type": "application/json" },
  }), {
    requireAuth: async () => okAuth,
    resolveTimezoneForAuth: async () => ({
      tz: "America/Santiago",
      source: "branch",
      userId: 5,
      sucursalId: 2,
      zonaHorariaUsuario: null,
      zonaHorariaSucursal: "America/Santiago",
    }),
    updateUserTimezone: async (input) => {
      updates.push(input);
    },
    isValidTimezone: isValidTimezoneMock,
  });

  assert.deepEqual(updates, [{ userId: 5, zonaHoraria: null }]);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    data: {
      zonaHoraria: null,
      zonaHorariaSucursal: "America/Santiago",
      zonaHorariaResuelta: "America/Santiago",
      timezoneSource: "branch",
    },
    message: "Se volvió a heredar la zona horaria de sucursal",
  });
});

test("handleGetMe expone payload consistente con timezoneSource y sucursales permitidas", async () => {
  const response = await handleGetMe({
    requireAuth: async () => okAuth,
    findUserById: async () => ({
      id: 5,
      nombre: "Ana",
      email: "ana@example.com",
      rol: "EMPLEADO",
      activo: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      sucursalId: null,
      zonaHoraria: null,
      subscription: null,
    }),
    resolveTimezoneForAuth: async () => ({
      tz: "America/Santiago",
      source: "branch",
      userId: 5,
      sucursalId: 2,
      zonaHorariaUsuario: null,
      zonaHorariaSucursal: "America/Santiago",
    }),
    findAdminBranches: async () => [],
    findEmployeeBranches: async (sucursalId) => [{ id: sucursalId, nombre: "Central", esPrincipal: true, activa: true }],
  });

  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.data.zonaHorariaResuelta, "America/Santiago");
  assert.equal(body.data.timezoneSource, "branch");
  assert.deepEqual(body.data.sucursalesPermitidas, [{ id: 1, nombre: "Central", esPrincipal: true, activa: true }]);
});
