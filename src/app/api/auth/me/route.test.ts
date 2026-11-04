import assert from "node:assert/strict";
import test, { before } from "node:test";

type HandleGetMe = typeof import("@/app/api/auth/me/route").handleGetMe;
type MeDeps = NonNullable<Parameters<HandleGetMe>[0]>;

let handleGetMe: HandleGetMe;

before(async () => {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:1/test";
  process.env.JWT_SECRET ??= "auth-me-characterization-secret-1234567890";
  ({ handleGetMe } = await import("@/app/api/auth/me/route"));
});

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

test("GET /api/auth/me no serializa el hash ni campos fuera del contrato", async () => {
  const deps = {
    requireAuth: async () => okAuth,
    // El fake devuelve el hash a propósito: aunque el adaptador lo traiga, la
    // respuesta no puede exponerlo.
    findUserById: async () => ({
      id: 5,
      nombre: "Ana",
      email: "ana@example.com",
      hash: "$2b$10$hash-que-no-debe-salir",
      rol: "EMPLEADO",
      activo: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
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
    findEmployeeBranches: async (sucursalId: number) => [
      { id: sucursalId, nombre: "Central", esPrincipal: true, activa: true },
    ],
  } as unknown as MeDeps;

  const response = await handleGetMe(deps);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.hash, undefined);
  assert.deepEqual(
    Object.keys(body.data).sort(),
    [
      "activo",
      "createdAt",
      "email",
      "id",
      "nombre",
      "rol",
      "subscription",
      "sucursalId",
      "sucursalesPermitidas",
      "timezoneSource",
      "zonaHoraria",
      "zonaHorariaResuelta",
      "zonaHorariaSucursal",
    ].sort(),
  );
  assert.deepEqual(body.data.sucursalesPermitidas, [
    { id: 1, nombre: "Central", esPrincipal: true, activa: true },
  ]);
  assert.equal(body.data.zonaHorariaResuelta, "America/Santiago");
});
