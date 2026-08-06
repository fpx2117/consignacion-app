import assert from "node:assert/strict";
import test from "node:test";
import {
  DashboardDateRangeError,
  parseDashboardDateQuery,
  resolveDashboardDateWhere,
  validateDashboardDateRange,
} from "@/lib/dashboard/date-range";

test("resuelve un rango personalizado inclusivo respetando cambios de horario", () => {
  const range = { from: "2026-03-29", to: "2026-03-29" };

  assert.deepEqual(
    resolveDashboardDateWhere(
      "custom",
      new Date("2026-03-29T12:00:00.000Z"),
      "Europe/Madrid",
      range,
    ),
    {
      gte: new Date("2026-03-28T23:00:00.000Z"),
      lt: new Date("2026-03-29T22:00:00.000Z"),
    },
  );
});

test("rechaza fechas inexistentes", () => {
  assert.throws(
    () => validateDashboardDateRange({ from: "2026-02-30", to: "2026-03-01" }),
    DashboardDateRangeError,
  );
});

test("rechaza un rango invertido", () => {
  assert.throws(
    () => validateDashboardDateRange({ from: "2026-05-10", to: "2026-05-09" }),
    /posterior/i,
  );
});

test("acepta hasta 366 dias inclusivos y rechaza rangos mayores", () => {
  assert.deepEqual(
    validateDashboardDateRange({ from: "2024-01-01", to: "2024-12-31" }),
    { from: "2024-01-01", to: "2024-12-31" },
  );
  assert.throws(
    () => validateDashboardDateRange({ from: "2024-01-01", to: "2025-01-01" }),
    /366 dias/i,
  );
});

test("mantiene historico sin limites y acota los periodos predefinidos", () => {
  const now = new Date("2026-08-05T15:00:00.000Z");

  assert.equal(
    resolveDashboardDateWhere("all", now, "America/Argentina/Buenos_Aires"),
    undefined,
  );
  assert.deepEqual(
    resolveDashboardDateWhere("today", now, "America/Argentina/Buenos_Aires"),
    {
      gte: new Date("2026-08-05T03:00:00.000Z"),
      lt: new Date("2026-08-06T03:00:00.000Z"),
    },
  );
});

test("valida el contrato recibido por query string", () => {
  assert.deepEqual(
    parseDashboardDateQuery(
      new URLSearchParams("period=custom&from=2026-08-01&to=2026-08-05"),
    ),
    {
      period: "custom",
      range: { from: "2026-08-01", to: "2026-08-05" },
    },
  );
  assert.throws(
    () => parseDashboardDateQuery(new URLSearchParams("period=quarter")),
    /periodo solicitado/i,
  );
  assert.throws(
    () => parseDashboardDateQuery(new URLSearchParams("period=custom")),
    /Desde y Hasta/i,
  );
});
