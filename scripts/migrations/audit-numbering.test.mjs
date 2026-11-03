import assert from "node:assert/strict";
import test from "node:test";

import { auditNumbering } from "./audit-numbering.mjs";

test("audits numbering in a read-only repeatable-read transaction", async () => {
  const statements = [];
  const resultSets = [
    [{ scopeId: 1, total: 3, nulls: 1, max: 7 }],
    [{ scopeId: 1, number: 7, count: 2, ids: [10, 11] }],
    [{ scopeId: 4, total: 2, nulls: 0, max: 2 }],
    [],
  ];
  const client = {
    async query(statement) {
      statements.push(statement);
      if (statement === "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY") {
        return { rows: [] };
      }
      if (statement === "ROLLBACK") return { rows: [] };
      return { rows: resultSets.shift() };
    },
  };

  const report = await auditNumbering(client);

  assert.deepEqual(report, {
    ventas: {
      scopes: [{ scopeId: 1, total: 3, nulls: 1, max: 7 }],
      duplicates: [{ scopeId: 1, number: 7, count: 2, ids: [10, 11] }],
    },
    consignaciones: {
      scopes: [{ scopeId: 4, total: 2, nulls: 0, max: 2 }],
      duplicates: [],
    },
  });
  assert.equal(statements[0], "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  assert.equal(statements.at(-1), "ROLLBACK");
  assert.match(statements[1], /GROUP BY "sucursalId"/);
  assert.match(statements[2], /GROUP BY "sucursalId", "numeroVenta"/);
  assert.match(statements[3], /GROUP BY "clienteId"/);
  assert.match(statements[4], /GROUP BY "clienteId", "numeroFolio"/);
  assert.equal(resultSets.length, 0);
});

test("rolls back when an audit query fails", async () => {
  const statements = [];
  const client = {
    async query(statement) {
      statements.push(statement);
      if (statement.includes('FROM "Venta"')) throw new Error("audit failed");
      return { rows: [] };
    },
  };

  await assert.rejects(() => auditNumbering(client), /audit failed/);
  assert.equal(statements.at(-1), "ROLLBACK");
});
