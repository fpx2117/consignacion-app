import assert from "node:assert/strict";
import test from "node:test";
import {
  TECHNICAL_FALLBACK_TZ,
  isValidTimezone,
  resolveTimezoneWithDeps,
} from "@/lib/timezone/get-configured-tz";

test("resolveTimezoneWithDeps prioriza timezone de usuario valida", async () => {
  const resolved = await resolveTimezoneWithDeps(
    { userId: 7, sucursalId: 4 },
    {
      getUserTimezoneRecord: async () => ({ id: 7, zonaHoraria: "Europe/Madrid" }),
      getBranchTimezoneRecord: async () => ({ sucursalId: 4, zonaHoraria: "America/Bogota" }),
    },
  );

  assert.deepEqual(resolved, {
    tz: "Europe/Madrid",
    source: "user",
    userId: 7,
    sucursalId: 4,
    zonaHorariaUsuario: "Europe/Madrid",
    zonaHorariaSucursal: "America/Bogota",
  });
});

test("resolveTimezoneWithDeps hereda sucursal cuando usuario no define timezone valida", async () => {
  const resolved = await resolveTimezoneWithDeps(
    { userId: 8, sucursalId: 3 },
    {
      getUserTimezoneRecord: async () => ({ id: 8, zonaHoraria: "Mars/Base" }),
      getBranchTimezoneRecord: async () => ({ sucursalId: 3, zonaHoraria: "America/Santiago" }),
    },
  );

  assert.equal(resolved.tz, "America/Santiago");
  assert.equal(resolved.source, "branch");
  assert.equal(resolved.zonaHorariaUsuario, null);
  assert.equal(resolved.zonaHorariaSucursal, "America/Santiago");
});

test("resolveTimezoneWithDeps usa fallback tecnico y registra observabilidad cuando ambos niveles son invalidos", async () => {
  const fallbackLogs: string[] = [];

  const resolved = await resolveTimezoneWithDeps(
    { userId: 11, sucursalId: 2 },
    {
      getUserTimezoneRecord: async () => ({ id: 11, zonaHoraria: "Invalid/User" }),
      getBranchTimezoneRecord: async () => ({ sucursalId: 2, zonaHoraria: "Invalid/Branch" }),
      logFallbackTimezone: (timezone) => fallbackLogs.push(`${timezone.userId}:${timezone.sucursalId}:${timezone.source}`),
    },
  );

  assert.equal(resolved.tz, TECHNICAL_FALLBACK_TZ);
  assert.equal(resolved.source, "fallback");
  assert.deepEqual(fallbackLogs, ["11:2:fallback"]);
});

test("resolveTimezoneWithDeps soporta vista global resolviendo sucursal fallback sin hardcodear id 1", async () => {
  const resolved = await resolveTimezoneWithDeps(
    { userId: 15, sucursalId: 0 },
    {
      getUserTimezoneRecord: async () => ({ id: 15, zonaHoraria: null }),
      getBranchTimezoneRecord: async (sucursalId) => {
        assert.equal(sucursalId, 0);
        return { sucursalId: 9, zonaHoraria: "America/Bogota" };
      },
    },
  );

  assert.equal(resolved.tz, "America/Bogota");
  assert.equal(resolved.source, "branch");
  assert.equal(resolved.sucursalId, 9);
});

test("isValidTimezone distingue timezones IANA validas e invalidas", () => {
  assert.equal(isValidTimezone("America/Bogota"), true);
  assert.equal(isValidTimezone("Invalid/Timezone"), false);
  assert.equal(isValidTimezone(null), false);
});
