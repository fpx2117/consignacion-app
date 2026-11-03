import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import pg from "pg";
import {
  expectedChecksums,
  validateMigrationHistory,
} from "./preflight-t11.mjs";

const BRANDING_MIGRATION =
  "20260523120000_add_storefront_content_to_branding";
const BRANDING_PATH =
  "prisma/migrations/20260523120000_add_storefront_content_to_branding/migration.sql";
const BRANDING_COMMITS = [
  "eab98db7bb67a580ffeabcbe7f5ea2611494a74c",
  "12ac09bdaabf4c5a7b319b02714a5bc237908a30",
  "a85fa3456d4f9bdd1bad275e194f4c397472bf59",
];

async function query(url, sql) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await client.query(sql);
  } finally {
    await client.end();
  }
}

export async function seedLegacy(url) {
  await query(
    url,
    `
      INSERT INTO "Sucursal" (id, nombre, "esPrincipal", "updatedAt")
      VALUES (1, 'Principal', true, now()), (2, 'Branch 2', false, now());
      INSERT INTO "Usuario" (id, nombre, email, hash, "sucursalId", "updatedAt")
      VALUES (1, 'User 2', 't11-branch2@example.test', 'unused', 2, now());
      INSERT INTO "Cliente" (id, nombre, "sucursalId")
      VALUES (1, 'Client 2', 2);
      INSERT INTO "Categoria" (nombre) VALUES ('Legacy category');
      INSERT INTO "Caja" (id, nombre, "sucursalId") VALUES (1, 'Legacy cash', 2);
      INSERT INTO "SesionCaja" (id, "cajaId", "usuarioId", "montoInicial")
      VALUES (1, 1, 1, 100);
      INSERT INTO "Pago" ("clienteId", monto, metodo, "sesionCajaId")
      VALUES (1, 25.50, 'EFECTIVO', 1);
    `,
  );
}

export async function verifyLegacy(url) {
  const result = await query(
    url,
    `SELECT c."sucursalId" category_branch,
       p."sucursalId" payment_branch, p.tipo, p.monto::text monto
     FROM "Categoria" c CROSS JOIN "Pago" p
     WHERE c.nombre = 'Legacy category'`,
  );
  assert.deepEqual(result.rows, [
    { category_branch: 1, payment_branch: 2, tipo: "VENTA", monto: "25.50" },
  ]);
}

function hashVariants(content) {
  const lf = content.replace(/\r\n/g, "\n");
  const crlf = lf.replace(/\n/g, "\r\n");
  return [lf, crlf].map((value) =>
    createHash("sha256").update(value).digest("hex"),
  );
}

export async function verifyHistoryValidation(url) {
  const result = await query(
    url,
    `SELECT migration_name, checksum,
       finished_at IS NOT NULL finished,
       rolled_back_at IS NOT NULL rolled_back
     FROM _prisma_migrations ORDER BY started_at`,
  );
  await validateMigrationHistory(result.rows);

  const checksumMap = await expectedChecksums();
  const first = result.rows[0];
  const alternate = [...checksumMap.get(first.migration_name)].find(
    (checksum) => checksum !== first.checksum,
  );
  assert.ok(alternate);
  await validateMigrationHistory([
    { ...first, checksum: alternate },
    ...result.rows.slice(1),
  ]);

  const branding = result.rows.find(
    (row) => row.migration_name === BRANDING_MIGRATION,
  );
  for (const commit of BRANDING_COMMITS) {
    const shown = spawnSync("git", ["show", `${commit}:${BRANDING_PATH}`], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    assert.equal(shown.status, 0, shown.stderr);
    for (const checksum of hashVariants(shown.stdout)) {
      assert.ok(checksumMap.get(BRANDING_MIGRATION).has(checksum));
      await validateMigrationHistory(
        result.rows.map((row) =>
          row === branding ? { ...row, checksum } : row,
        ),
      );
    }
  }

  await assert.rejects(
    validateMigrationHistory(result.rows.slice(1)),
    /Expected one successful .* row, found 0/,
  );
  await assert.rejects(
    validateMigrationHistory([
      ...result.rows,
      {
        migration_name: "20990101000000_unknown",
        checksum: "0".repeat(64),
        finished: true,
        rolled_back: false,
      },
    ]),
    /Unknown migration history row/,
  );
  await assert.rejects(
    validateMigrationHistory([
      { ...result.rows[0], checksum: "0".repeat(64) },
      ...result.rows.slice(1),
    ]),
    /Unsupported checksum/,
  );
  await assert.rejects(
    validateMigrationHistory([
      { ...result.rows[0], finished: true, rolled_back: true },
      ...result.rows.slice(1),
    ]),
    /Malformed migration history rows/,
  );
  await assert.rejects(
    validateMigrationHistory([
      ...result.rows,
      { ...result.rows[0], finished: false, rolled_back: true },
    ]),
    /Unexpected rolled-back row/,
  );

  const t11Checksum = [...
    checksumMap.get("20261101010000_reconcile_schema_history"),
  ][0];
  const rolledBackT11 = {
    migration_name: "20261101010000_reconcile_schema_history",
    checksum: t11Checksum,
    finished: false,
    rolled_back: true,
  };
  const t12Name = "20261101020000_establish_numbering_authority";
  const rolledBackT12 = {
    migration_name: t12Name,
    checksum: [...checksumMap.get(t12Name)][0],
    finished: false,
    rolled_back: true,
  };
  await assert.rejects(
    validateMigrationHistory([...result.rows, rolledBackT12]),
    /Post-T11 migration exists without a successful T11 row/,
  );
  await validateMigrationHistory([
    ...result.rows,
    {
      migration_name: "20261101010000_reconcile_schema_history",
      checksum: t11Checksum,
      finished: true,
      rolled_back: false,
    },
    rolledBackT12,
  ]);
  await assert.rejects(
    validateMigrationHistory([
      ...result.rows,
      rolledBackT11,
      rolledBackT11,
    ]),
    /Too many rolled-back .* rows: 2/,
  );
}

export async function seedCurrentBranchOnly(url) {
  await query(
    url,
    `INSERT INTO "Sucursal" (id, nombre, "esPrincipal", "updatedAt")
     VALUES (2, 'Only branch 2', true, now())`,
  );
}

export async function insertCurrentCategory(url) {
  await query(
    url,
    `INSERT INTO "Categoria" (nombre, "sucursalId")
     VALUES ('Current category', 2)`,
  );
}

export async function assertCurrentCategory(url) {
  const result = await query(
    url,
    `SELECT "sucursalId" FROM "Categoria" WHERE nombre = 'Current category'`,
  );
  assert.equal(result.rows[0].sucursalId, 2);
}

export async function assertPaymentBranch(url, expected) {
  const result = await query(url, `SELECT "sucursalId" FROM "Pago" WHERE id = 1`);
  assert.equal(result.rows[0].sucursalId, expected);
}

export async function createPartialState(url) {
  await query(
    url,
    `ALTER TABLE "Branding"
     ADD COLUMN "isBannerSlider" BOOLEAN NOT NULL DEFAULT false`,
  );
}

export async function seedPaymentConflict(url) {
  await query(
    url,
    `
      INSERT INTO "Sucursal" (id, nombre, "esPrincipal", "updatedAt")
      VALUES (1, 'Branch 1', true, now()), (2, 'Branch 2', false, now());
      INSERT INTO "Usuario" (id, nombre, email, hash, "sucursalId", "updatedAt")
      VALUES (1, 'User 2', 't11-conflict@example.test', 'unused', 2, now());
      INSERT INTO "Cliente" (id, nombre, "sucursalId") VALUES (1, 'Client 1', 1);
      INSERT INTO "Caja" (id, nombre, "sucursalId") VALUES (1, 'Cash 2', 2);
      INSERT INTO "SesionCaja" (id, "cajaId", "usuarioId", "montoInicial")
      VALUES (1, 1, 1, 100);
      INSERT INTO "Pago" ("clienteId", monto, metodo, "sesionCajaId")
      VALUES (1, 25.50, 'EFECTIVO', 1);
    `,
  );
}

export async function verifyMigrationRollback(url) {
  const result = await query(
    url,
    `SELECT
       to_regclass('public."Gasto"') IS NULL gasto_absent,
       to_regclass('public."Categoria_nombre_sucursalId_key"') IS NULL index_absent,
       NOT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'Categoria'
           AND column_name = 'sucursalId'
       ) categoria_column_absent,
       NOT EXISTS (
         SELECT 1 FROM pg_constraint
         WHERE conname = 'Categoria_sucursalId_fkey'
       ) constraint_absent,
       NOT EXISTS (
         SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
         WHERE t.typname = 'ShareLinkType' AND e.enumlabel = 'REPORTE_DASHBOARD'
       ) enum_value_absent`,
  );
  assert.deepEqual(result.rows, [
    {
      gasto_absent: true,
      index_absent: true,
      categoria_column_absent: true,
      constraint_absent: true,
      enum_value_absent: true,
    },
  ]);
}

export async function correctPaymentConflict(url) {
  await query(url, `UPDATE "Cliente" SET "sucursalId" = 2 WHERE id = 1`);
}
