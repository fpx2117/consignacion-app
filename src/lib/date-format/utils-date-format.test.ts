import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDateInputAR,
  formatDateTimeAR,
  monthRangeAR,
  parseDateTimeInputAR,
  startOfDayAR,
} from "@/lib/date-format/utils-date";
import { formatDate, formatDateTime, formatDateWithOptions } from "@/lib/date-format/utils-format";

test("utils-date respeta cambios de dia y mes en America/Bogota", () => {
  const iso = "2026-03-01T02:30:00.000Z";

  assert.equal(formatDateInputAR(iso, "America/Bogota"), "2026-02-28");
  assert.match(formatDateTimeAR(iso, true, "America/Bogota"), /28\/02\/2026.*21:30/);
  assert.equal(startOfDayAR(new Date(iso), "America/Bogota").toISOString(), "2026-02-28T05:00:00.000Z");
});

test("utils-date calcula rangos mensuales con timezone explicita en Europe/Madrid", () => {
  const range = monthRangeAR(2026, 2, "Europe/Madrid");

  assert.equal(range.start.toISOString(), "2026-02-28T23:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-03-31T22:59:59.999Z");
  assert.equal(parseDateTimeInputAR("2026-03-01", "00:15", "Europe/Madrid").toISOString(), "2026-02-28T23:15:00.000Z");
});

test("utils-date conserva el dia operativo esperado en America/Santiago", () => {
  const iso = "2026-04-01T02:30:00.000Z";

  assert.equal(formatDateInputAR(iso, "America/Santiago"), "2026-03-31");
  assert.match(formatDateTimeAR(iso, true, "America/Santiago"), /31\/03\/2026.*23:30/);
});

test("utils-format formatea con timezone explicita y maneja valores vacios", () => {
  const iso = "2026-03-01T02:30:00.000Z";

  assert.equal(formatDate(iso, "America/Bogota"), "28/02/2026");
  assert.match(formatDateTime(iso, "Europe/Madrid"), /01\/03\/2026.*03:30/);
  assert.equal(
    formatDateWithOptions(iso, { month: "long", day: "2-digit", year: "numeric" }, "America/Santiago", "-"),
    "28 de febrero de 2026",
  );
  assert.equal(formatDate(null, "America/Bogota"), "-");
});
