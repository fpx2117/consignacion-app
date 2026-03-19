import assert from "node:assert/strict";
import test from "node:test";
import { handleGetHistorialYears } from "@/app/api/historial/anios/route";

type HistorialDeps = NonNullable<Parameters<typeof handleGetHistorialYears>[0]>;
type HistorialAuth = Awaited<ReturnType<HistorialDeps["requireAuth"]>>;

const okAuth: HistorialAuth = {
  ok: true as const,
  user: {
    sub: "9",
    rol: "ADMIN" as const,
    email: "admin@example.com",
    nombre: "Admin",
    sucursalId: null,
  },
  activeSucursalId: 0,
  allowedSucursalIds: [1, 2],
  isGlobalView: true,
  token: "token",
};

test("handleGetHistorialYears usa la timezone resuelta para agrupar anios", async () => {
  const response = await handleGetHistorialYears({
    requireAuth: async () => okAuth,
    resolveTimezoneForAuth: async () => ({
      tz: "Europe/Madrid",
      source: "user",
      userId: 9,
      sucursalId: 4,
      zonaHorariaUsuario: "Europe/Madrid",
      zonaHorariaSucursal: "America/Santiago",
    }),
    buildSucursalWhere: () => ({ sucursalId: { in: [4] } } as unknown as ReturnType<HistorialDeps["buildSucursalWhere"]>),
    findMovimientos: async () => [
      { createdAt: new Date("2025-12-31T23:30:00.000Z") },
      { createdAt: new Date("2024-06-01T12:00:00.000Z") },
      { createdAt: new Date("2025-12-31T23:30:00.000Z") },
    ],
    nowAR: () => new Date("2026-01-01T10:00:00.000Z"),
  } as unknown as HistorialDeps);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [2026, 2024]);
});

test("handleGetHistorialYears cae al anio actual efectivo cuando no hay movimientos", async () => {
  const response = await handleGetHistorialYears({
    requireAuth: async () => okAuth,
    resolveTimezoneForAuth: async () => ({
      tz: "America/Bogota",
      source: "branch",
      userId: 9,
      sucursalId: 4,
      zonaHorariaUsuario: null,
      zonaHorariaSucursal: "America/Bogota",
    }),
    buildSucursalWhere: () => ({ sucursalId: { in: [4] } } as unknown as ReturnType<HistorialDeps["buildSucursalWhere"]>),
    findMovimientos: async () => [],
    nowAR: () => new Date("2026-01-01T04:30:00.000Z"),
  } as unknown as HistorialDeps);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [2025]);
});
