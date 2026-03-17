import assert from "node:assert/strict";
import test from "node:test";
import { handlePostGasto } from "@/app/api/gastos/route";

type GastoDeps = NonNullable<Parameters<typeof handlePostGasto>[1]>;
type GastoAuth = Awaited<ReturnType<GastoDeps["requireAuth"]>>;

const okAuth: GastoAuth = {
  ok: true as const,
  user: {
    sub: "13",
    rol: "ADMIN" as const,
    email: "admin@example.com",
    nombre: "Admin",
    sucursalId: 6,
  },
  activeSucursalId: 6,
  token: "token",
};

test("handlePostGasto usa la timezone resuelta al parsear fechas explicitas", async () => {
  const parseCalls: Array<{ date: string; time: string; tz: string }> = [];
  const createdDates: Array<{ fecha: Date; fechaVencimiento: Date | null }> = [];
  const startDate = new Date("2026-04-01T15:00:00.000Z");
  const endDate = new Date("2026-04-30T04:59:00.000Z");

  const response = await handlePostGasto(
    new Request("http://localhost/api/gastos", {
      method: "POST",
      body: JSON.stringify({
        monto: 25000,
        motivo: "Alquiler",
        fecha: "2026-04-01",
        hora: "10:00",
        fechaVencimiento: "2026-04-29",
        horaVencimiento: "23:59",
        categoriaGastoId: 8,
      }),
      headers: { "Content-Type": "application/json" },
    }),
    ({
      requireAuth: async () => okAuth,
      isGlobalSucursalView: () => false,
      resolveTimezoneForAuth: async () => ({
        tz: "America/Bogota",
        source: "user",
        userId: 13,
        sucursalId: 6,
        zonaHorariaUsuario: "America/Bogota",
        zonaHorariaSucursal: "America/Santiago",
      }),
      nowAR: () => new Date("2026-04-01T00:00:00.000Z"),
      parseDateTimeInputAR: (date: string, time: string, tz: string) => {
        parseCalls.push({ date, time, tz });
        return parseCalls.length === 1 ? startDate : endDate;
      },
      prisma: {
        gasto: {
          create: async ({ data }: { data: { fecha: Date; fechaVencimiento: Date | null } }) => {
            createdDates.push({ fecha: data.fecha, fechaVencimiento: data.fechaVencimiento });
            return { id: 90, ...data, categoria: { id: 8, nombre: "Servicios" } };
          },
        },
        gastoSucursal: {
          createMany: async () => ({ count: 0 }),
        },
      },
    } as unknown as GastoDeps),
  );

  assert.equal(response.status, 201);
  assert.deepEqual(parseCalls, [
    { date: "2026-04-01", time: "10:00", tz: "America/Bogota" },
    { date: "2026-04-29", time: "23:59", tz: "America/Bogota" },
  ]);
  assert.deepEqual(createdDates.map((item) => ({ fecha: item.fecha.toISOString(), fechaVencimiento: item.fechaVencimiento?.toISOString() ?? null })), [
    { fecha: "2026-04-01T15:00:00.000Z", fechaVencimiento: "2026-04-30T04:59:00.000Z" },
  ]);
});

test("handlePostGasto usa nowAR con la timezone resuelta cuando no recibe fecha", async () => {
  const nowCalls: string[] = [];
  let createdDate: unknown = null;

  const response = await handlePostGasto(
    new Request("http://localhost/api/gastos", {
      method: "POST",
      body: JSON.stringify({
        monto: 1800,
        motivo: "Taxi",
        categoriaGastoId: 5,
      }),
      headers: { "Content-Type": "application/json" },
    }),
    ({
      requireAuth: async () => okAuth,
      isGlobalSucursalView: () => false,
      resolveTimezoneForAuth: async () => ({
        tz: "Europe/Madrid",
        source: "user",
        userId: 13,
        sucursalId: 6,
        zonaHorariaUsuario: "Europe/Madrid",
        zonaHorariaSucursal: "America/Santiago",
      }),
      nowAR: (tz: string) => {
        nowCalls.push(tz);
        return new Date("2026-05-03T08:00:00.000Z");
      },
      parseDateTimeInputAR: () => {
        throw new Error("parseDateTimeInputAR no deberia llamarse sin fecha");
      },
      prisma: {
        gasto: {
          create: async ({ data }: { data: { fecha: Date } }) => {
            createdDate = data.fecha;
            return { id: 91, ...data, categoria: { id: 5, nombre: "Movilidad" } };
          },
        },
        gastoSucursal: {
          createMany: async () => ({ count: 0 }),
        },
      },
    } as unknown as GastoDeps),
  );

  assert.equal(response.status, 201);
  assert.deepEqual(nowCalls, ["Europe/Madrid"]);
  assert.ok(createdDate instanceof Date);
  assert.equal(createdDate.toISOString(), "2026-05-03T08:00:00.000Z");
});
