import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_TIMEZONE_SESSION,
  createTimezoneSessionStore,
  fetchTimezoneSessionWithApi,
  resetTimezoneSessionCache,
} from "@/hooks/useTimezone";

test.afterEach(() => {
  resetTimezoneSessionCache();
});

test("fetchTimezoneSessionWithApi usa /api/auth/me como cache compartida", async () => {
  const store = createTimezoneSessionStore();
  let calls = 0;
  const getSession = async () => {
    calls += 1;
    return {
      rol: "ADMIN" as const,
      zonaHoraria: "America/Bogota",
      zonaHorariaSucursal: "America/Santiago",
      zonaHorariaResuelta: "America/Bogota",
      timezoneSource: "user" as const,
    };
  };

  const first = await fetchTimezoneSessionWithApi(getSession, store);
  const second = await fetchTimezoneSessionWithApi(getSession, store);

  assert.equal(calls, 1);
  assert.equal(first.zonaHorariaResuelta, "America/Bogota");
  assert.equal(second.timezoneSource, "user");
});

test("fetchTimezoneSessionWithApi permite force refresh y reemplaza la timezone cacheada", async () => {
  const store = createTimezoneSessionStore();
  const responses = [
    {
      rol: "EMPLEADO" as const,
      zonaHoraria: null,
      zonaHorariaSucursal: "America/Santiago",
      zonaHorariaResuelta: "America/Santiago",
      timezoneSource: "branch" as const,
    },
    {
      rol: "EMPLEADO" as const,
      zonaHoraria: "Europe/Madrid",
      zonaHorariaSucursal: "America/Santiago",
      zonaHorariaResuelta: "Europe/Madrid",
      timezoneSource: "user" as const,
    },
  ];
  let index = 0;

  const first = await fetchTimezoneSessionWithApi(async () => responses[index++], store);
  const refreshed = await fetchTimezoneSessionWithApi(async () => responses[index++], store, true);

  assert.equal(first.zonaHorariaResuelta, "America/Santiago");
  assert.equal(refreshed.zonaHorariaResuelta, "Europe/Madrid");
  assert.equal(store.cachedSession?.timezoneSource, "user");
});

test("fetchTimezoneSessionWithApi cae al fallback tecnico cuando falla la carga inicial", async () => {
  const store = createTimezoneSessionStore();
  const session = await fetchTimezoneSessionWithApi(async () => {
    throw new Error("network");
  }, store);

  assert.deepEqual(session, DEFAULT_TIMEZONE_SESSION);
});

test("fetchTimezoneSessionWithApi reutiliza cache previa ante error posterior", async () => {
  const store = createTimezoneSessionStore();
  await fetchTimezoneSessionWithApi(async () => ({
    rol: "EMPLEADO" as const,
    zonaHoraria: null,
    zonaHorariaSucursal: "America/Bogota",
    zonaHorariaResuelta: "America/Bogota",
    timezoneSource: "branch" as const,
  }), store);

  const session = await fetchTimezoneSessionWithApi(async () => {
    throw new Error("network");
  }, store, true);

  assert.equal(session.zonaHorariaResuelta, "America/Bogota");
  assert.equal(session.timezoneSource, "branch");
});
