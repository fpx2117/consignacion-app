import assert from "node:assert/strict";
import test from "node:test";

import { getPersistedConsignacionFolio } from "./consignacion-numbering";

test("uses the folio returned by persistence for downstream effects", () => {
  const localCandidate = 4;
  const persistedConsignacion = { numeroFolio: 9 };

  const effectFolio = getPersistedConsignacionFolio(persistedConsignacion);

  assert.notEqual(effectFolio, localCandidate);
  assert.equal(effectFolio, persistedConsignacion.numeroFolio);
});
