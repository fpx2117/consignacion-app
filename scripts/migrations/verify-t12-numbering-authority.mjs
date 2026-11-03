import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { auditNumbering } from "./audit-numbering.mjs";
import { createDatabase, migrate } from "./t11-test-runtime.mjs";

const T12_MIGRATION = "20261101020000_establish_numbering_authority";
const prismaCli = resolve("node_modules/prisma/build/index.js");
const migrationPath = `prisma/migrations/${T12_MIGRATION}/migration.sql`;
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
    "T12 authority verification requires a confirmed local database ending in test",
  );
}

const names = {
  fresh: `${baseName}_authority_fresh`,
  legacy: `${baseName}_authority_legacy`,
  dirtyVenta: `${baseName}_authority_dirty_venta`,
  dirtyConsignacion: `${baseName}_authority_dirty_consignacion`,
  exhausted: `${baseName}_authority_exhausted`,
  nullData: `${baseName}_authority_null_data`,
  nullable: `${baseName}_authority_nullable`,
  conflictingTrigger: `${baseName}_authority_conflicting_trigger`,
  lateFailure: `${baseName}_authority_late_failure`,
};
for (const name of Object.values(names)) {
  if (!/^[a-zA-Z0-9_]+$/.test(name) || name.length > 63) {
    throw new Error(`Unsafe database name: ${name}`);
  }
}

function databaseUrl(name) {
  const url = new URL(baseUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

async function writeMigrationConfig(root, includeT12, failLate = false) {
  const migrations = join(root, "migrations");
  await mkdir(migrations, { recursive: true });
  await cp(
    "prisma/migrations/migration_lock.toml",
    join(migrations, "migration_lock.toml"),
  );
  const entries = await readdir("prisma/migrations", { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!includeT12 && entry.name >= T12_MIGRATION) continue;
    await cp(join("prisma/migrations", entry.name), join(migrations, entry.name), {
      recursive: true,
    });
  }
  if (failLate) {
    const migration = join(migrations, T12_MIGRATION, "migration.sql");
    const sql = await readFile(migration, "utf8");
    assert.match(sql, /\nCOMMIT;\s*$/);
    await writeFile(
      migration,
      sql.replace(
        /\nCOMMIT;\s*$/,
        "\nDO $$ BEGIN RAISE EXCEPTION 'T12 late failure'; END $$;\n\nCOMMIT;\n",
      ),
    );
  }

  const schema = resolve("prisma/schema.prisma").replaceAll("\\", "/");
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

function expectMigrationFailure(url, config, expected) {
  const result = spawnSync(
    process.execPath,
    [prismaCli, "migrate", "deploy", "--config", config],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: url },
      encoding: "utf8",
    },
  );
  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}\n${result.stdout}`, expected);
}

function expectPrismaSuccess(url, args, expected) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  const output = `${result.stderr}\n${result.stdout}`;
  assert.equal(result.status, 0, output);
  if (expected) assert.match(output, expected);
}

async function expectSqlFailure(url, expected) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const sql = await readFile(migrationPath, "utf8");
    await assert.rejects(client.query(sql), expected);
  } finally {
    await client.end();
  }
}

async function seedScopes(client) {
  const sucursales = await client.query(`
    INSERT INTO public."Sucursal" (nombre, "esPrincipal", "updatedAt")
    VALUES ('T12 A', true, now()), ('T12 B', false, now())
    RETURNING id`);
  const clientes = await client.query(
    `INSERT INTO public."Cliente" (nombre, "sucursalId")
     VALUES ('T12 Client A', $1), ('T12 Client B', $1), ('T12 Client C', $2)
     RETURNING id`,
    [sucursales.rows[0].id, sucursales.rows[1].id],
  );
  return {
    sucursalA: sucursales.rows[0].id,
    sucursalB: sucursales.rows[1].id,
    clienteA: clientes.rows[0].id,
    clienteB: clientes.rows[1].id,
    clienteC: clientes.rows[2].id,
  };
}

async function insertVenta(client, clienteId, sucursalId, candidate = null) {
  const result = await client.query(
    `INSERT INTO public."Venta" (
       "clienteId", total, "sucursalId", "numeroVenta"
     ) VALUES ($1, 10, $2, $3)
     RETURNING id, "numeroVenta"`,
    [clienteId, sucursalId, candidate],
  );
  return result.rows[0];
}

async function insertVentaWithoutNumber(client, clienteId, sucursalId) {
  const result = await client.query(
    `INSERT INTO public."Venta" ("clienteId", total, "sucursalId")
     VALUES ($1, 10, $2)
     RETURNING id, "numeroVenta"`,
    [clienteId, sucursalId],
  );
  return result.rows[0];
}

async function insertConsignacion(client, clienteId, sucursalId, candidate) {
  const result = await client.query(
    `INSERT INTO public."Consignacion" (
       "clienteId", "sucursalId", "numeroFolio"
     ) VALUES ($1, $2, $3)
     RETURNING id, "numeroFolio"`,
    [clienteId, sucursalId, candidate],
  );
  return result.rows[0];
}

async function authorityObjects(client) {
  const result = await client.query(`
    SELECT
      to_regclass('public."VentaNumerador"')::text AS venta_counter,
      to_regclass('public."ConsignacionNumerador"')::text AS consignacion_counter,
      to_regclass('public."Venta_sucursalId_numeroVenta_key_t12"')::text AS venta_index,
      to_regclass('public."Consignacion_clienteId_numeroFolio_key_t12"')::text AS consignacion_index,
      (SELECT COUNT(*)::int FROM pg_catalog.pg_proc
       WHERE pronamespace = 'public'::regnamespace AND proname LIKE 't12_%') AS functions,
      (SELECT COUNT(*)::int FROM pg_catalog.pg_trigger
       WHERE NOT tgisinternal AND tgname LIKE 't12_%') AS triggers
  `);
  return result.rows[0];
}

async function assertAuthorityPresent(client) {
  assert.deepEqual(await authorityObjects(client), {
    venta_counter: '"VentaNumerador"',
    consignacion_counter: '"ConsignacionNumerador"',
    venta_index: '"Venta_sucursalId_numeroVenta_key_t12"',
    consignacion_index: '"Consignacion_clienteId_numeroFolio_key_t12"',
    functions: 4,
    triggers: 4,
  });
  const indexes = await client.query(`
    SELECT c.relname, i.indisunique, i.indisvalid, i.indisready,
      jsonb_agg(a.attname ORDER BY key.ordinality) AS columns
    FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_class c ON c.oid = i.indexrelid
    JOIN unnest(i.indkey) WITH ORDINALITY AS key(attnum, ordinality) ON true
    JOIN pg_catalog.pg_attribute a
      ON a.attrelid = i.indrelid AND a.attnum = key.attnum
    WHERE c.relname IN (
      'Venta_sucursalId_numeroVenta_key_t12',
      'Consignacion_clienteId_numeroFolio_key_t12'
    )
    GROUP BY c.relname, i.indisunique, i.indisvalid, i.indisready
    ORDER BY c.relname`);
  assert.equal(indexes.rowCount, 2);
  for (const index of indexes.rows) {
    assert.equal(index.indisunique, true);
    assert.equal(index.indisvalid, true);
    assert.equal(index.indisready, true);
  }
  assert.deepEqual(indexes.rows, [
    {
      relname: "Consignacion_clienteId_numeroFolio_key_t12",
      indisunique: true,
      indisvalid: true,
      indisready: true,
      columns: ["clienteId", "numeroFolio"],
    },
    {
      relname: "Venta_sucursalId_numeroVenta_key_t12",
      indisunique: true,
      indisvalid: true,
      indisready: true,
      columns: ["sucursalId", "numeroVenta"],
    },
  ]);
}

async function numberingDataSnapshot(client) {
  const result = await client.query(`
    SELECT
      COALESCE((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.id) FROM public."Venta" v), '[]') AS ventas,
      COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM public."Consignacion" c), '[]') AS consignaciones
  `);
  return result.rows[0];
}

async function assertAuthorityAbsent(client) {
  assert.deepEqual(await authorityObjects(client), {
    venta_counter: null,
    consignacion_counter: null,
    venta_index: null,
    consignacion_index: null,
    functions: 0,
    triggers: 0,
  });
}

async function verifyFresh(url) {
  migrate(url);
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const version = await client.query("SHOW server_version_num");
    assert.match(version.rows[0].server_version_num, /^16\d{4}$/);
    await assertAuthorityPresent(client);
    const ids = await seedScopes(client);
    const ventaA = await insertVenta(client, ids.clienteA, ids.sucursalA, 999);
    const ventaB = await insertVenta(client, ids.clienteB, ids.sucursalA, 999);
    const ventaC = await insertVenta(client, ids.clienteA, ids.sucursalB, 999);
    const consignacionA = await insertConsignacion(
      client,
      ids.clienteA,
      ids.sucursalA,
      999,
    );
    const consignacionB = await insertConsignacion(
      client,
      ids.clienteA,
      ids.sucursalB,
      999,
    );
    const consignacionC = await insertConsignacion(
      client,
      ids.clienteB,
      ids.sucursalA,
      999,
    );
    assert.equal(ventaA.numeroVenta, 1);
    assert.equal(ventaB.numeroVenta, 2);
    assert.equal(ventaC.numeroVenta, 1);
    assert.equal(consignacionA.numeroFolio, 1);
    assert.equal(consignacionB.numeroFolio, 2);
    assert.equal(consignacionC.numeroFolio, 1);
  } finally {
    await client.end();
  }
  expectPrismaSuccess(url, ["migrate", "status"], /Database schema is up to date/);
  expectPrismaSuccess(url, [
    "migrate",
    "diff",
    "--from-config-datasource",
    "--to-schema",
    "prisma/schema.prisma",
    "--exit-code",
  ]);
}

async function verifyLegacy(url, beforeT12Config, runtimeRole) {
  migrate(url, beforeT12Config);
  const client = new pg.Client({ connectionString: url });
  let historicalNull;
  await client.connect();
  try {
    const ids = await seedScopes(client);
    const seededVentas = await client.query(
      `INSERT INTO public."Venta" (
         "clienteId", total, "sucursalId", "numeroVenta"
       ) VALUES ($1, 10, $3, 7), ($1, 10, $3, NULL), ($2, 10, $4, 12)
       RETURNING to_jsonb("Venta") AS row`,
      [ids.clienteA, ids.clienteB, ids.sucursalA, ids.sucursalB],
    );
    historicalNull = seededVentas.rows.find(
      ({ row }) => row.numeroVenta === null,
    )?.row;
    assert.ok(historicalNull);
    await client.query(
      `INSERT INTO public."Consignacion" (
         "clienteId", "sucursalId", "numeroFolio"
       ) VALUES ($1, $3, 2), ($2, $4, 5)`,
      [ids.clienteA, ids.clienteB, ids.sucursalA, ids.sucursalB],
    );
  } finally {
    await client.end();
  }

  migrate(url);
  const verified = new pg.Client({ connectionString: url });
  await verified.connect();
  try {
    await assertAuthorityPresent(verified);
    const ids = await verified.query(`
      SELECT
        (SELECT id FROM public."Sucursal" WHERE nombre = 'T12 A') AS sucursal_a,
        (SELECT id FROM public."Sucursal" WHERE nombre = 'T12 B') AS sucursal_b,
        (SELECT id FROM public."Cliente" WHERE nombre = 'T12 Client A') AS cliente_a,
        (SELECT id FROM public."Cliente" WHERE nombre = 'T12 Client B') AS cliente_b`);
    const scope = ids.rows[0];
    const preservedNull = await verified.query(
      `SELECT to_jsonb(v) AS row FROM public."Venta" v WHERE id = $1`,
      [historicalNull.id],
    );
    assert.deepEqual(preservedNull.rows[0].row, historicalNull);
    assert.equal(
      (await insertVenta(verified, scope.cliente_a, scope.sucursal_a, 999))
        .numeroVenta,
      8,
    );
    assert.equal(
      (await insertVenta(verified, scope.cliente_b, scope.sucursal_b, 999))
        .numeroVenta,
      13,
    );
    assert.equal(
      (
        await insertConsignacion(
          verified,
          scope.cliente_a,
          scope.sucursal_a,
          999,
        )
      ).numeroFolio,
      3,
    );

    await verified.query("BEGIN");
    const rolledBack = await insertVenta(
      verified,
      scope.cliente_a,
      scope.sucursal_a,
      999,
    );
    await verified.query("ROLLBACK");
    const reused = await insertVentaWithoutNumber(
      verified,
      scope.cliente_a,
      scope.sucursal_a,
    );
    assert.equal(reused.numeroVenta, rolledBack.numeroVenta);

    await assert.rejects(
      () =>
        verified.query(
          `UPDATE public."Venta" SET "numeroVenta" = 500 WHERE id = $1`,
          [reused.id],
        ),
      /immutable/,
    );
    await assert.rejects(
      () =>
        verified.query(
          `UPDATE public."Consignacion" SET "clienteId" = $1 WHERE id = (
             SELECT MIN(id) FROM public."Consignacion"
           )`,
          [scope.cliente_b],
        ),
      /immutable/,
    );

    const concurrentClients = await Promise.all(
      Array.from({ length: 8 }, async () => {
        const concurrent = new pg.Client({ connectionString: url });
        await concurrent.connect();
        return concurrent;
      }),
    );
    try {
      const concurrentVentas = await Promise.all(
        concurrentClients.map((concurrent) =>
          insertVenta(concurrent, scope.cliente_a, scope.sucursal_a, null),
        ),
      );
      const numbers = concurrentVentas
        .map((row) => row.numeroVenta)
        .sort((a, b) => a - b);
      assert.equal(new Set(numbers).size, numbers.length);
      assert.deepEqual(
        numbers,
        Array.from({ length: 8 }, (_, index) => reused.numeroVenta + index + 1),
      );
      const concurrentConsignaciones = await Promise.all(
        concurrentClients.map((concurrent) =>
          insertConsignacion(
            concurrent,
            scope.cliente_a,
            scope.sucursal_a,
            999,
          ),
        ),
      );
      const folios = concurrentConsignaciones
        .map((row) => row.numeroFolio)
        .sort((a, b) => a - b);
      assert.equal(new Set(folios).size, folios.length);
      assert.deepEqual(
        folios,
        Array.from({ length: 8 }, (_, index) => 4 + index),
      );
    } finally {
      await Promise.all(concurrentClients.map((concurrent) => concurrent.end()));
    }

    await verified.query(`GRANT USAGE ON SCHEMA public TO "${runtimeRole}"`);
    await verified.query(
      `GRANT SELECT, INSERT, UPDATE ON public."Venta", public."Consignacion" TO "${runtimeRole}"`,
    );
    await verified.query(
      `GRANT USAGE, SELECT ON SEQUENCE public."Venta_id_seq", public."Consignacion_id_seq" TO "${runtimeRole}"`,
    );
    const privileges = await verified.query(
      `SELECT
         has_function_privilege($1, 'public.t12_assign_venta_numero()', 'EXECUTE') AS venta_function_execute,
         has_function_privilege($1, 'public.t12_assign_consignacion_folio()', 'EXECUTE') AS consignacion_function_execute,
         has_table_privilege($1, 'public."VentaNumerador"', 'UPDATE') AS venta_counter_update,
         has_table_privilege($1, 'public."ConsignacionNumerador"', 'UPDATE') AS consignacion_counter_update`,
      [runtimeRole],
    );
    assert.deepEqual(privileges.rows[0], {
      venta_function_execute: false,
      consignacion_function_execute: false,
      venta_counter_update: false,
      consignacion_counter_update: false,
    });
    await verified.query(`SET ROLE "${runtimeRole}"`);
    try {
      const restricted = await insertVenta(
        verified,
        scope.cliente_a,
        scope.sucursal_a,
        999,
      );
      assert.equal(typeof restricted.numeroVenta, "number");
      const restrictedConsignacion = await insertConsignacion(
        verified,
        scope.cliente_a,
        scope.sucursal_a,
        999,
      );
      assert.equal(typeof restrictedConsignacion.numeroFolio, "number");
      await assert.rejects(
        () => verified.query(`SELECT * FROM public."VentaNumerador"`),
        /permission denied/,
      );
      await assert.rejects(
        () => verified.query(`SELECT * FROM public."ConsignacionNumerador"`),
        /permission denied/,
      );
      await assert.rejects(
        () =>
          verified.query(
            `ALTER TABLE public."Venta" DISABLE TRIGGER "t12_assign_venta_numero"`,
          ),
        /must be owner/,
      );
    } finally {
      await verified.query("RESET ROLE");
    }

    const beforeRollback = await numberingDataSnapshot(verified);
    const rollback = await readFile(
      `prisma/migrations/${T12_MIGRATION}/rollback.sql`,
      "utf8",
    );
    await verified.query(rollback);
    await assertAuthorityAbsent(verified);
    const afterRollback = await numberingDataSnapshot(verified);
    assert.deepEqual(afterRollback, beforeRollback);
  } finally {
    await verified.end();
  }
}

async function seedDuplicate(url, beforeT12Config, table) {
  migrate(url, beforeT12Config);
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const ids = await seedScopes(client);
    if (table === "Venta") {
      await client.query(
        `INSERT INTO public."Venta" (
           "clienteId", total, "sucursalId", "numeroVenta"
         ) VALUES ($1, 10, $2, 4), ($1, 10, $2, 4)`,
        [ids.clienteA, ids.sucursalA],
      );
    } else {
      await client.query(
        `INSERT INTO public."Consignacion" (
           "clienteId", "sucursalId", "numeroFolio"
         ) VALUES ($1, $2, 4), ($1, $2, 4)`,
        [ids.clienteA, ids.sucursalA],
      );
    }
    const audit = await auditNumbering(client);
    const duplicates =
      table === "Venta"
        ? audit.ventas.duplicates
        : audit.consignaciones.duplicates;
    assert.equal(duplicates.length, 1);
    assert.equal(duplicates[0].count, 2);
  } finally {
    await client.end();
  }
  await expectSqlFailure(url, new RegExp(`duplicate ${table} numbering`));
  const verification = new pg.Client({ connectionString: url });
  await verification.connect();
  try {
    await assertAuthorityAbsent(verification);
  } finally {
    await verification.end();
  }
}

async function verifyLateFailure(url, lateFailureConfig) {
  expectMigrationFailure(url, lateFailureConfig, /T12 late failure/);
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await assertAuthorityAbsent(client);
  } finally {
    await client.end();
  }
}

async function verifyRejectedState(url, beforeT12Config, setup, expected) {
  migrate(url, beforeT12Config);
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const ids = await seedScopes(client);
    await setup(client, ids);
  } finally {
    await client.end();
  }
  await expectSqlFailure(url, expected.error);
  const verification = new pg.Client({ connectionString: url });
  await verification.connect();
  try {
    await assertAuthorityAbsent(verification);
    await expected.verify(verification);
  } finally {
    await verification.end();
  }
}

const admin = new pg.Client({ connectionString: databaseUrl("postgres") });
const temporary = await mkdtemp(join(tmpdir(), "t12-numbering-authority-"));
const createdDatabases = [];
const runtimeRole = `t12_runtime_${process.pid}_${randomUUID().slice(0, 8)}`;
let runtimeRoleCreated = false;
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
  const existingRole = await admin.query(
    "SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = $1",
    [runtimeRole],
  );
  if (existingRole.rowCount) {
    throw new Error(`Refusing to reuse existing role: ${runtimeRole}`);
  }
  for (const name of Object.values(names)) {
    await createDatabase(admin, name);
    createdDatabases.push(name);
  }

  const beforeT12Config = await writeMigrationConfig(
    join(temporary, "before-t12"),
    false,
  );
  const lateFailureConfig = await writeMigrationConfig(
    join(temporary, "late-failure"),
    true,
    true,
  );

  await verifyFresh(databaseUrl(names.fresh));
  await admin.query(`CREATE ROLE "${runtimeRole}" NOLOGIN`);
  runtimeRoleCreated = true;
  await verifyLegacy(databaseUrl(names.legacy), beforeT12Config, runtimeRole);
  await seedDuplicate(databaseUrl(names.dirtyVenta), beforeT12Config, "Venta");
  await seedDuplicate(
    databaseUrl(names.dirtyConsignacion),
    beforeT12Config,
    "Consignacion",
  );
  await verifyRejectedState(
    databaseUrl(names.exhausted),
    beforeT12Config,
    async (client, ids) => {
      await client.query(
        `INSERT INTO public."Venta" (
           "clienteId", total, "sucursalId", "numeroVenta"
         ) VALUES ($1, 10, $2, 2147483647)`,
        [ids.clienteA, ids.sucursalA],
      );
    },
    {
      error: /integer numbering exhausted/,
      verify: async (client) => {
        const result = await client.query(
          `SELECT COUNT(*)::int AS count FROM public."Venta"
           WHERE "numeroVenta" = 2147483647`,
        );
        assert.equal(result.rows[0].count, 1);
      },
    },
  );
  await verifyRejectedState(
    databaseUrl(names.nullData),
    beforeT12Config,
    async (client, ids) => {
      await client.query(
        `ALTER TABLE public."Consignacion" ALTER COLUMN "numeroFolio" DROP NOT NULL`,
      );
      await client.query(
        `INSERT INTO public."Consignacion" (
           "clienteId", "sucursalId", "numeroFolio"
         ) VALUES ($1, $2, NULL)`,
        [ids.clienteA, ids.sucursalA],
      );
    },
    {
      error: /unexpected null scope or folio/,
      verify: async (client) => {
        const result = await client.query(
          `SELECT COUNT(*)::int AS count FROM public."Consignacion"
           WHERE "numeroFolio" IS NULL`,
        );
        assert.equal(result.rows[0].count, 1);
      },
    },
  );
  await verifyRejectedState(
    databaseUrl(names.nullable),
    beforeT12Config,
    async (client) => {
      await client.query(
        `ALTER TABLE public."Consignacion" ALTER COLUMN "numeroFolio" DROP NOT NULL`,
      );
    },
    {
      error: /unexpected column nullability/,
      verify: async (client) => {
        const result = await client.query(`
          SELECT attnotnull
          FROM pg_catalog.pg_attribute
          WHERE attrelid = 'public."Consignacion"'::regclass
            AND attname = 'numeroFolio'`);
        assert.equal(result.rows[0].attnotnull, false);
      },
    },
  );
  await verifyRejectedState(
    databaseUrl(names.conflictingTrigger),
    beforeT12Config,
    async (client) => {
      await client.query(`
        CREATE FUNCTION public.preexisting_venta_trigger()
        RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
        CREATE TRIGGER preexisting_venta_trigger
        BEFORE INSERT ON public."Venta"
        FOR EACH ROW EXECUTE FUNCTION public.preexisting_venta_trigger();`);
    },
    {
      error: /conflicting BEFORE trigger/,
      verify: async (client) => {
        const result = await client.query(`
          SELECT COUNT(*)::int AS count
          FROM pg_catalog.pg_trigger
          WHERE tgname = 'preexisting_venta_trigger'`);
        assert.equal(result.rows[0].count, 1);
      },
    },
  );
  await verifyLateFailure(databaseUrl(names.lateFailure), lateFailureConfig);
  console.log("T12 numbering authority verification passed");
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
    if (runtimeRoleCreated) {
      await admin.query(`DROP ROLE "${runtimeRole}"`);
    }
  } catch (error) {
    cleanupErrors.push(error);
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
    throw new AggregateError(cleanupErrors, "T12 authority cleanup failed");
  }
}
