import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { auditNumbering } from "./audit-numbering.mjs";
import {
  createDatabase,
  createPostT11Config,
  migrate,
} from "./t11-test-runtime.mjs";

const baseUrl = process.env.TEST_DATABASE_URL;
if (!baseUrl) throw new Error("TEST_DATABASE_URL is required");

const parsed = new URL(baseUrl);
const baseName = parsed.pathname.slice(1);
const local = ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname);
if (
  !local ||
  !/(?:^|[_-])test$/.test(baseName) ||
  process.env.T12_CONFIRM_DATABASE !== baseName
) {
  throw new Error(
    "T12 verification requires a confirmed local database ending in test",
  );
}

const auditDatabase = `${baseName}_audit`;
if (!/^[a-zA-Z0-9_]+$/.test(auditDatabase) || auditDatabase.length > 63) {
  throw new Error(`Unsafe database name: ${auditDatabase}`);
}

function databaseUrl(name) {
  const url = new URL(baseUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

const admin = new pg.Client({ connectionString: databaseUrl("postgres") });
await admin.connect();
let created = false;
let temporary;
try {
  const existing = await admin.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [auditDatabase],
  );
  if (existing.rowCount) {
    throw new Error(`Refusing to overwrite existing database: ${auditDatabase}`);
  }

  await createDatabase(admin, auditDatabase);
  created = true;
  const url = databaseUrl(auditDatabase);
  // The audit inspects legacy data with duplicates/nulls, which T12-B's
  // authority intentionally makes impossible. Run it on the post-T11 schema,
  // before the T12 unique indexes and triggers.
  temporary = await mkdtemp(join(tmpdir(), "t12-audit-"));
  const postT11Config = await createPostT11Config(temporary);
  migrate(url, postT11Config);

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const sucursales = await client.query(`
      INSERT INTO "Sucursal" (nombre, "esPrincipal", "updatedAt")
      VALUES ('T12 Audit A', true, now()), ('T12 Audit B', false, now())
      RETURNING id`);
    const clientes = await client.query(
      `INSERT INTO "Cliente" (nombre, "sucursalId")
       VALUES ('T12 Client A', $1), ('T12 Client B', $2) RETURNING id`,
      [sucursales.rows[0].id, sucursales.rows[1].id],
    );
    await client.query(
      `INSERT INTO "Venta" ("clienteId", total, "sucursalId", "numeroVenta")
       VALUES
         ($1, 10, $3, 7), ($1, 20, $3, 7), ($1, 30, $3, NULL),
         ($2, 40, $4, 12)`,
      [
        clientes.rows[0].id,
        clientes.rows[1].id,
        sucursales.rows[0].id,
        sucursales.rows[1].id,
      ],
    );
    await client.query(
      `INSERT INTO "Consignacion" ("clienteId", "sucursalId", "numeroFolio")
       VALUES ($1, $3, 2), ($1, $3, 2), ($2, $4, 5)`,
      [
        clientes.rows[0].id,
        clientes.rows[1].id,
        sucursales.rows[0].id,
        sucursales.rows[1].id,
      ],
    );

    const report = await auditNumbering(client);
    assert.deepEqual(report.ventas.scopes, [
      { scopeId: sucursales.rows[0].id, total: 3, nulls: 1, max: 7 },
      { scopeId: sucursales.rows[1].id, total: 1, nulls: 0, max: 12 },
    ]);
    assert.equal(report.ventas.duplicates.length, 1);
    assert.equal(report.ventas.duplicates[0].count, 2);
    assert.deepEqual(report.consignaciones.scopes, [
      { scopeId: clientes.rows[0].id, total: 2, nulls: 0, max: 2 },
      { scopeId: clientes.rows[1].id, total: 1, nulls: 0, max: 5 },
    ]);
    assert.equal(report.consignaciones.duplicates.length, 1);
    assert.equal(report.consignaciones.duplicates[0].count, 2);
    console.log(JSON.stringify(report, null, 2));
    console.log("T12 numbering audit verification passed");
  } finally {
    await client.end();
  }
} finally {
  if (created) await admin.query(`DROP DATABASE "${auditDatabase}" WITH (FORCE)`);
  if (temporary) await rm(temporary, { recursive: true, force: true });
  await admin.end();
}
