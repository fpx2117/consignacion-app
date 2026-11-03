import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import {
  assertCurrentCategory,
  assertPaymentBranch,
  correctPaymentConflict,
  createPartialState,
  insertCurrentCategory,
  seedCurrentBranchOnly,
  seedLegacy,
  seedPaymentConflict,
  verifyHistoryValidation,
  verifyLegacy,
  verifyMigrationRollback,
} from "./t11-test-fixtures.mjs";
import {
  createDatabase,
  createLateFailureConfig,
  createLegacyConfig,
  createT11SchemaConfig,
  dbPush,
  expectLateMigrationFailure,
  expectMigrationConflict,
  expectPreflightFailure,
  migrate,
  migrateStatus,
  preflight,
  resolveRolledBack,
} from "./t11-test-runtime.mjs";

const baseUrl = process.env.TEST_DATABASE_URL;
if (!baseUrl) throw new Error("TEST_DATABASE_URL is required");

const parsed = new URL(baseUrl);
const baseName = parsed.pathname.slice(1);
const local = ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname);
if (
  !local ||
  !/(?:^|[_-])test$/.test(baseName) ||
  process.env.T11_CONFIRM_DATABASE !== baseName
) {
  throw new Error(
    "T11 verification requires a confirmed local database ending in test",
  );
}

const names = {
  fresh: `${baseName}_fresh`,
  legacy: `${baseName}_legacy`,
  current: `${baseName}_current`,
  currentPayment: `${baseName}_current_payment`,
  partial: `${baseName}_partial`,
  conflict: `${baseName}_conflict`,
  lateFailure: `${baseName}_late_failure`,
};
for (const name of Object.values(names)) {
  if (!/^[a-zA-Z0-9_]+$/.test(name) || Buffer.byteLength(name) > 63) {
    throw new Error(`Unsafe database name: ${name}`);
  }
}

function databaseUrl(name) {
  const url = new URL(baseUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

const admin = new pg.Client({ connectionString: databaseUrl("postgres") });
const temporary = await mkdtemp(join(tmpdir(), "t11-repair-"));
const createdDatabases = [];
await admin.connect();
try {
  const existing = await admin.query(
    `SELECT datname FROM pg_database WHERE datname = ANY($1::text[])`,
    [Object.values(names)],
  );
  if (existing.rowCount) {
    throw new Error(
      `Refusing to overwrite existing databases: ${existing.rows
        .map((row) => row.datname)
        .join(", ")}`,
    );
  }
  for (const name of Object.values(names)) {
    await createDatabase(admin, name);
    createdDatabases.push(name);
  }

  const legacyConfig = await createLegacyConfig(temporary);
  const t11SchemaConfig = await createT11SchemaConfig(temporary);

  const freshUrl = databaseUrl(names.fresh);
  preflight(freshUrl);
  migrate(freshUrl);
  preflight(freshUrl, true);
  migrateStatus(freshUrl);

  const legacyUrl = databaseUrl(names.legacy);
  migrate(legacyUrl, legacyConfig);
  await verifyHistoryValidation(legacyUrl);
  await seedLegacy(legacyUrl);
  preflight(legacyUrl);
  migrate(legacyUrl);
  preflight(legacyUrl, true);
  migrateStatus(legacyUrl);
  await verifyLegacy(legacyUrl);

  const currentUrl = databaseUrl(names.current);
  migrate(currentUrl, legacyConfig);
  await seedCurrentBranchOnly(currentUrl);
  dbPush(currentUrl, t11SchemaConfig);
  await insertCurrentCategory(currentUrl);
  preflight(currentUrl);
  migrate(currentUrl);
  preflight(currentUrl, true);
  migrateStatus(currentUrl);
  await assertCurrentCategory(currentUrl);

  const currentPaymentUrl = databaseUrl(names.currentPayment);
  migrate(currentPaymentUrl, legacyConfig);
  await seedLegacy(currentPaymentUrl);
  dbPush(currentPaymentUrl, t11SchemaConfig);
  await assertPaymentBranch(currentPaymentUrl, 1);
  preflight(currentPaymentUrl);
  migrate(currentPaymentUrl);
  preflight(currentPaymentUrl, true);
  migrateStatus(currentPaymentUrl);
  await assertPaymentBranch(currentPaymentUrl, 2);

  const partialUrl = databaseUrl(names.partial);
  migrate(partialUrl, legacyConfig);
  await createPartialState(partialUrl);
  expectPreflightFailure(partialUrl);

  const conflictUrl = databaseUrl(names.conflict);
  migrate(conflictUrl, legacyConfig);
  await seedPaymentConflict(conflictUrl);
  preflight(conflictUrl);
  expectMigrationConflict(conflictUrl);
  await verifyMigrationRollback(conflictUrl);
  expectPreflightFailure(conflictUrl, /Unresolved failed migrations/);
  resolveRolledBack(conflictUrl);
  await correctPaymentConflict(conflictUrl);
  preflight(conflictUrl);
  migrate(conflictUrl);
  preflight(conflictUrl, true);
  migrateStatus(conflictUrl);

  const lateFailureUrl = databaseUrl(names.lateFailure);
  migrate(lateFailureUrl, legacyConfig);
  await seedLegacy(lateFailureUrl);
  const lateFailureConfig = await createLateFailureConfig(temporary);
  expectLateMigrationFailure(lateFailureUrl, lateFailureConfig);
  await verifyMigrationRollback(lateFailureUrl);
  console.log("T11 migration repair verification passed");
} finally {
  const cleanupErrors = [];
  for (const name of createdDatabases) {
    try {
      await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  try {
    await admin.end();
  } catch (error) {
    cleanupErrors.push(error);
  }
  try {
    await rm(temporary, { recursive: true, force: true });
  } catch (error) {
    cleanupErrors.push(error);
  }
  if (cleanupErrors.length) {
    throw new AggregateError(cleanupErrors, "T11 test cleanup failed");
  }
}
