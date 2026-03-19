import assert from "node:assert/strict";
import test from "node:test";
import { handlePatchTurno, handlePostTurno, handlePutTurno } from "@/app/api/settings/pos/cajas/turno/route";

type TurnoPostDeps = NonNullable<Parameters<typeof handlePostTurno>[1]>;
type TurnoPatchDeps = NonNullable<Parameters<typeof handlePatchTurno>[1]>;
type TurnoPutDeps = NonNullable<Parameters<typeof handlePutTurno>[1]>;
type TurnoAuth = Awaited<ReturnType<TurnoPostDeps["requireAuth"]>>;

const okAuth: TurnoAuth = {
  ok: true as const,
  user: {
    sub: "9",
    rol: "ADMIN" as const,
    email: "admin@example.com",
    nombre: "Admin",
    sucursalId: 4,
  },
  activeSucursalId: 4,
  allowedSucursalIds: [4],
  isGlobalView: false,
  token: "token",
};

test("handlePostTurno valida horario laboral con la timezone resuelta", async () => {
  const nowCalls: string[] = [];
  const dayCalls: string[] = [];
  const timeCalls: string[] = [];
  const createdSessions: Array<{ cajaId: number; usuarioId: number }> = [];

  const response = await handlePostTurno(
    new Request("http://localhost/api/settings/pos/cajas/turno", {
      method: "POST",
      body: JSON.stringify({ cajaId: 12, montoInicial: 5000 }),
      headers: { "Content-Type": "application/json" },
    }),
    ({
      requireAuth: async () => okAuth,
      resolveTimezoneForAuth: async () => ({
        tz: "Europe/Madrid",
        source: "user",
        userId: 9,
        sucursalId: 4,
        zonaHorariaUsuario: "Europe/Madrid",
        zonaHorariaSucursal: "America/Santiago",
      }),
      nowAR: (tz: string) => {
        nowCalls.push(tz);
        return new Date("2026-03-10T10:15:00.000Z");
      },
      getDayOfWeekAR: (_date: Date | undefined, tz: string) => {
        dayCalls.push(tz);
        return 2;
      },
      getTimeStringAR: (_date: Date | undefined, tz: string) => {
        timeCalls.push(tz);
        return "11:15";
      },
      prisma: {
        horarioLaboral: {
          findUnique: async () => ({ activo: true, horaInicio: "08:00", horaFin: "18:00" }),
        },
        caja: {
          findUnique: async () => ({ id: 12, sucursalId: 4 }),
        },
        sesionCaja: {
          findFirst: async () => null,
          create: async ({ data }: { data: { cajaId: number; usuarioId: number } }) => {
            createdSessions.push(data);
            return { id: 81, ...data };
          },
        },
      },
    } as unknown as TurnoPostDeps),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(nowCalls, ["Europe/Madrid"]);
  assert.deepEqual(dayCalls, ["Europe/Madrid"]);
  assert.deepEqual(timeCalls, ["Europe/Madrid"]);
  assert.deepEqual(createdSessions, [{ cajaId: 12, usuarioId: 9, montoInicial: 5000, estado: "ABIERTA" }]);
});

test("handlePatchTurno genera la etiqueta de extension con la timezone resuelta", async () => {
  const timeCalls: string[] = [];
  let updatedObservaciones = "";

  const response = await handlePatchTurno(
    new Request("http://localhost/api/settings/pos/cajas/turno", {
      method: "PATCH",
      body: JSON.stringify({ minutos: 30 }),
      headers: { "Content-Type": "application/json" },
    }),
    ({
      requireAuth: async () => okAuth,
      resolveTimezoneForAuth: async () => ({
        tz: "America/Bogota",
        source: "user",
        userId: 9,
        sucursalId: 4,
        zonaHorariaUsuario: "America/Bogota",
        zonaHorariaSucursal: "America/Santiago",
      }),
      nowAR: () => new Date("2026-03-10T13:15:00.000Z"),
      getDayOfWeekAR: () => 0,
      getTimeStringAR: (_date: Date | undefined, tz: string) => {
        timeCalls.push(tz);
        return "08:15";
      },
      prisma: {
        horarioLaboral: { findUnique: async () => null },
        caja: { findUnique: async () => null },
        sesionCaja: {
          findFirst: async () => ({ id: 55, observaciones: "Turno manana" }),
          update: async ({ data }: { data: { observaciones: string } }) => {
            updatedObservaciones = data.observaciones;
            return { id: 55, observaciones: data.observaciones };
          },
        },
      },
    } as unknown as TurnoPatchDeps),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(timeCalls, ["America/Bogota"]);
  assert.match(updatedObservaciones, /\[EXTENSI(?:ON|ÓN) 30MIN: 08:15\]/);
});

test("handlePutTurno usa la timezone resuelta al fechar el cierre", async () => {
  const nowCalls: string[] = [];
  let fechaCierre: unknown = null;

  const response = await handlePutTurno(
    new Request("http://localhost/api/settings/pos/cajas/turno", {
      method: "PUT",
      body: JSON.stringify({ montoReal: 1200, observaciones: "Sin diferencias" }),
      headers: { "Content-Type": "application/json" },
    }),
    ({
      requireAuth: async () => okAuth,
      resolveTimezoneForAuth: async () => ({
        tz: "America/Santiago",
        source: "branch",
        userId: 9,
        sucursalId: 4,
        zonaHorariaUsuario: null,
        zonaHorariaSucursal: "America/Santiago",
      }),
      nowAR: (tz: string) => {
        nowCalls.push(tz);
        return new Date("2026-03-10T21:45:00.000Z");
      },
      getDayOfWeekAR: () => 0,
      getTimeStringAR: () => "00:00",
      prisma: {
        horarioLaboral: { findUnique: async () => null },
        caja: { findUnique: async () => null },
        sesionCaja: {
          findFirst: async () => ({
            id: 77,
            montoInicial: 1000,
            observaciones: "Turno tarde",
            ventas: [],
            pagos: [],
            movimientos: [],
          }),
          update: async ({ data }: { data: { fechaCierre: Date } }) => {
            fechaCierre = data.fechaCierre;
            return { id: 77, ...data };
          },
        },
      },
    } as unknown as TurnoPutDeps),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(nowCalls, ["America/Santiago"]);
  assert.ok(fechaCierre instanceof Date);
  assert.equal(fechaCierre.toISOString(), "2026-03-10T21:45:00.000Z");
});
