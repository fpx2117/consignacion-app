import assert from "node:assert/strict";
import {
  appendFile,
  cp,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const prismaCli = resolve("node_modules/prisma/build/index.js");

function runResult(command, args, env = {}) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

function run(command, args, env = {}) {
  const result = runResult(command, args, env);
  if (result.status !== 0) {
    const diagnostic = [result.error?.message, result.stderr, result.stdout]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join("\n");
    throw new Error(diagnostic || `${command} failed`);
  }
  return result.stdout;
}

export function migrate(url, config) {
  const args = [prismaCli, "migrate", "deploy"];
  if (config) args.push("--config", config);
  run(process.execPath, args, { DATABASE_URL: url });
}

export function dbPush(url, config) {
  const args = [prismaCli, "db", "push", "--accept-data-loss"];
  if (config) args.push("--config", config);
  run(process.execPath, args, { DATABASE_URL: url });
}

export function migrateStatus(url) {
  run(process.execPath, [prismaCli, "migrate", "status"], {
    DATABASE_URL: url,
  });
}

export function preflight(url, requireCurrent = false) {
  const args = ["scripts/migrations/preflight-t11.mjs"];
  if (requireCurrent) args.push("--require-current");
  run(process.execPath, args, { DATABASE_URL: url });
}

export function expectPreflightFailure(
  url,
  expected = /Unsupported partial schema state; T11 deployment refused/,
) {
  const result = runResult(
    process.execPath,
    ["scripts/migrations/preflight-t11.mjs"],
    { DATABASE_URL: url },
  );
  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}\n${result.stdout}`, expected);
}

export function expectMigrationConflict(url) {
  const result = runResult(
    process.execPath,
    [prismaCli, "migrate", "deploy"],
    { DATABASE_URL: url },
  );
  assert.notEqual(result.status, 0);
  assert.match(
    `${result.stderr}\n${result.stdout}`,
    /Cannot infer Pago\.sucursalId: client and cash-session branches differ/,
  );
}

export function expectLateMigrationFailure(url, config) {
  const result = runResult(
    process.execPath,
    [prismaCli, "migrate", "deploy", "--config", config],
    { DATABASE_URL: url },
  );
  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}\n${result.stdout}`, /T11 late failure/);
}

export function resolveRolledBack(url) {
  run(
    process.execPath,
    [
      prismaCli,
      "migrate",
      "resolve",
      "--rolled-back",
      "20261101010000_reconcile_schema_history",
    ],
    { DATABASE_URL: url },
  );
}

export async function createDatabase(admin, name) {
  await admin.query(`CREATE DATABASE "${name}"`);
}

async function writeConfig(root, migrations, schemaPath = "prisma/schema.prisma") {
  const schema = resolve(schemaPath).replaceAll("\\", "/");
  const migrationPath = resolve(migrations).replaceAll("\\", "/");
  const prismaConfig = pathToFileURL(
    resolve("node_modules/prisma/config.js"),
  ).href;
  const config = join(root, "prisma.config.ts");
  await writeFile(
    config,
    `import { defineConfig, env } from "${prismaConfig}";\n` +
      `export default defineConfig({\n` +
      `  schema: "${schema}",\n` +
      `  migrations: { path: "${migrationPath}" },\n` +
      `  datasource: { url: env("DATABASE_URL") },\n` +
      `});\n`,
  );
  return config;
}

async function copyMigrations(root, includeT11) {
  const migrations = join(root, "migrations");
  await mkdir(migrations, { recursive: true });
  await cp(
    "prisma/migrations/migration_lock.toml",
    join(migrations, "migration_lock.toml"),
  );
  const entries = await readdir("prisma/migrations", { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!includeT11 && entry.name >= "20261101010000_") continue;
    await cp(
      join("prisma/migrations", entry.name),
      join(migrations, entry.name),
      { recursive: true },
    );
  }
  return migrations;
}

export async function createLegacyConfig(directory) {
  const migrations = await copyMigrations(directory, false);
  return writeConfig(directory, migrations);
}

export async function createPostT11Config(directory) {
  const root = join(directory, "post-t11");
  const migrations = join(root, "migrations");
  await mkdir(migrations, { recursive: true });
  await cp(
    "prisma/migrations/migration_lock.toml",
    join(migrations, "migration_lock.toml"),
  );
  const entries = await readdir("prisma/migrations", { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name > "20261101010000_reconcile_schema_history") continue;
    await cp(
      join("prisma/migrations", entry.name),
      join(migrations, entry.name),
      { recursive: true },
    );
  }
  return writeConfig(root, migrations);
}

export async function createT11SchemaConfig(directory) {
  const root = join(directory, "t11-schema");
  await mkdir(root, { recursive: true });
  const schemaPath = join(root, "schema.prisma");
  const current = await readFile("prisma/schema.prisma", "utf8");
  const t11Schema = current
    .replace(
      '  @@unique([clienteId, numeroFolio], map: "Consignacion_clienteId_numeroFolio_key_t12")',
      "  @@index([clienteId, numeroFolio])",
    )
    .replace(
      '  @@unique([sucursalId, numeroVenta], map: "Venta_sucursalId_numeroVenta_key_t12")\n',
      "",
    )
    .replace(
      /\nmodel VentaNumerador \{[\s\S]*?\n\}\n\nmodel ConsignacionNumerador \{[\s\S]*?\n\}\n/,
      "\n",
    )
    .replace(/\nmodel StockAutoridad \{[\s\S]*?\n\}\n/, "\n");
  if (t11Schema === current) {
    throw new Error("Failed to derive the schema snapshot before T12");
  }
  await writeFile(schemaPath, t11Schema);
  return writeConfig(root, resolve("prisma/migrations"), schemaPath);
}

export async function createLateFailureConfig(directory) {
  const root = join(directory, "late-failure");
  const migrations = await copyMigrations(root, true);
  await appendFile(
    join(migrations, "20261101010000_reconcile_schema_history", "migration.sql"),
    `\nDO $$ BEGIN RAISE EXCEPTION 'T11 late failure'; END $$;\n`,
  );
  return writeConfig(root, migrations);
}
