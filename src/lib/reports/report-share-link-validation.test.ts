import assert from "node:assert/strict";
import test from "node:test";
import { validateReportShareLink } from "@/lib/reports/report-share-link-validation";

const baseLink = {
  type: "REPORTE_POS",
  targetId: 25,
  expiresAt: new Date("2026-08-05T14:00:00.000Z"),
  views: 20,
  maxViews: 20,
  rangeStart: new Date("2026-08-01T00:00:00.000Z"),
  rangeEnd: new Date("2026-08-05T00:00:00.000Z"),
};

const request = {
  expectedType: "REPORTE_POS" as const,
  period: "custom" as const,
  requestedRange: { from: "2026-08-01", to: "2026-08-05" },
  hasViewedCookie: true,
  now: new Date("2026-08-05T13:00:00.000Z"),
};

test("acepta el ultimo acceso valido y obtiene la sucursal del enlace", () => {
  assert.deepEqual(validateReportShareLink(baseLink, request), {
    sucursalId: 2,
    range: request.requestedRange,
  });
});

test("rechaza enlaces vencidos, sin cookie o por encima del limite", () => {
  assert.equal(
    validateReportShareLink(baseLink, { ...request, hasViewedCookie: false }),
    null,
  );
  assert.equal(
    validateReportShareLink({ ...baseLink, expiresAt: request.now }, request),
    null,
  );
  assert.equal(
    validateReportShareLink({ ...baseLink, views: 21 }, request),
    null,
  );
});

test("rechaza tipo, periodo o rango manipulados", () => {
  assert.equal(
    validateReportShareLink(
      { ...baseLink, type: "REPORTE_CONSIGNACION" },
      request,
    ),
    null,
  );
  assert.equal(
    validateReportShareLink({ ...baseLink, targetId: 23 }, request),
    null,
  );
  assert.equal(
    validateReportShareLink(baseLink, {
      ...request,
      requestedRange: { from: "2026-08-02", to: "2026-08-05" },
    }),
    null,
  );
});
