import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import pg from "pg";
import { createDatabase, migrate } from "./t11-test-runtime.mjs";
import { compensateStockAuthority } from "./compensate-t14-stock-authority.mjs";

const prismaCli = resolve("node_modules/prisma/build/index.js");
const baseUrl = process.env.TEST_DATABASE_URL;
if (!baseUrl) throw new Error("TEST_DATABASE_URL is required");

const parsed = new URL(baseUrl);
const baseName = parsed.pathname.slice(1);
const local = ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname);
if (
  !local ||
  !/(?:^|[_-])test$/.test(baseName) ||
  process.env.T14_CONFIRM_DATABASE !== baseName
) {
  throw new Error(
    "T14 stock authority verification requires a confirmed local database ending in test",
  );
}

const names = {
  fresh: `${baseName}_t14_fresh_test`,
  rollback: `${baseName}_t14_rollback_test`,
  drain: `${baseName}_t14_drain_test`,
  lock: `${baseName}_t14_lock_test`,
  incompatible: `${baseName}_t14_incompatible_test`,
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

async function withClient(url, fn) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
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

async function driftCount(client) {
  const result = await client.query(`
    SELECT COUNT(*)::int AS count
    FROM public."Producto" AS producto
    LEFT JOIN (
      SELECT "productoId",
             SUM("stockDisponibleUnits") AS "disponible",
             SUM("stockConsignadoUnits") AS "consignado"
      FROM public."StockSucursal"
      GROUP BY "productoId"
    ) AS agregado ON agregado."productoId" = producto."id"
    WHERE producto."stockDisponibleUnits" <> COALESCE(agregado."disponible", 0)
       OR producto."stockConsignadoUnits" <> COALESCE(agregado."consignado", 0)
  `);
  return result.rows[0].count;
}

async function stockSnapshot(client) {
  const capability = await client.query(
    'SELECT "id", "modo" FROM public."StockAutoridad" ORDER BY "id"',
  );
  const trigger = await client.query(`
    SELECT COUNT(*)::int AS count
    FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public."StockSucursal"'::regclass
      AND tgname = 'trg_sync_producto_stock'
      AND NOT tgisinternal
  `);
  const products = await client.query(`
    SELECT "id", "stockDisponibleUnits", "stockConsignadoUnits"
    FROM public."Producto"
    ORDER BY "id"
  `);
  return {
    capability: capability.rows,
    trigger: trigger.rows[0].count,
    products: products.rows,
    drift: await driftCount(client),
  };
}

async function seedStock(client, divergent = true) {
  const sucursales = await client.query(`
    INSERT INTO public."Sucursal" (nombre, "esPrincipal", "updatedAt")
    VALUES ('T14 A', true, now()), ('T14 B', false, now())
    RETURNING id
  `);
  const productos = await client.query(
    `INSERT INTO public."Producto" (
       nombre, "precioVenta", "precioCosto", "updatedAt"
     ) VALUES ('T14 P1', 10, 5, now()), ('T14 P2', 20, 10, now()),
              ('T14 P3', 30, 15, now())
     RETURNING id`,
  );
  const [sucursalA, sucursalB] = sucursales.rows.map((row) => row.id);
  const [producto1, producto2, producto3] = productos.rows.map((row) => row.id);

  await client.query(
    `INSERT INTO public."StockSucursal" (
       "productoId", "sucursalId", "stockDisponibleUnits", "stockConsignadoUnits"
     ) VALUES ($1, $3, 10, 2), ($2, $3, 5, 1), ($1, $4, 3, 1)`,
    [producto1, producto2, sucursalA, sucursalB],
  );

  if (divergent) {
    await client.query(
      `UPDATE public."Producto"
       SET "stockDisponibleUnits" = 2, "stockConsignadoUnits" = 9
       WHERE "id" = $1`,
      [producto1],
    );
    await client.query(
      `UPDATE public."Producto"
       SET "stockDisponibleUnits" = 7, "stockConsignadoUnits" = 4
       WHERE "id" = $1`,
      [producto3],
    );
  }

  return { sucursalA, sucursalB, producto1, producto2, producto3 };
}

async function expectT14Rejection(url, name, expected) {
  await assert.rejects(
    compensateStockAuthority({
      connectionString: url,
      confirmDatabase: name,
      lockTimeoutMs: 500,
    }),
    expected,
  );
}

async function verifyFresh(url) {
  migrate(url);
  await withClient(url, async (client) => {
    const version = await client.query("SHOW server_version_num");
    assert.match(version.rows[0].server_version_num, /^16\d{4}$/);

    const snapshot = await stockSnapshot(client);
    assert.deepEqual(snapshot.capability, [
      { id: 1, modo: "APP_DUAL_WRITE" },
    ]);
    assert.equal(snapshot.trigger, 1);

    const ids = await seedStock(client);
    assert.ok((await driftCount(client)) > 0);

    // The rollback path from T16 starts at DB_PROJECTION with the projection
    // still active; compensation must prove the mode transition, not inherit
    // APP_DUAL_WRITE from the migration.
    await client.query(
      `UPDATE public."StockAutoridad" SET "modo" = 'DB_PROJECTION' WHERE "id" = 1`,
    );
    assert.deepEqual((await stockSnapshot(client)).capability, [
      { id: 1, modo: "DB_PROJECTION" },
    ]);

    await compensateStockAuthority({
      connectionString: url,
      confirmDatabase: names.fresh,
    });

    const compensated = await stockSnapshot(client);
    assert.deepEqual(compensated.capability, [
      { id: 1, modo: "APP_DUAL_WRITE" },
    ]);
    assert.equal(compensated.trigger, 0);
    assert.equal(compensated.drift, 0);
    assert.deepEqual(compensated.products, [
      {
        id: ids.producto1,
        stockDisponibleUnits: 13,
        stockConsignadoUnits: 3,
      },
      {
        id: ids.producto2,
        stockDisponibleUnits: 5,
        stockConsignadoUnits: 1,
      },
      {
        id: ids.producto3,
        stockDisponibleUnits: 0,
        stockConsignadoUnits: 0,
      },
    ]);
  });

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

async function verifyRollback(url) {
  migrate(url);
  await withClient(url, async (client) => {
    await seedStock(client);
    const before = await stockSnapshot(client);
    assert.equal(before.trigger, 1);
    assert.ok(before.drift > 0);

    await assert.rejects(
      compensateStockAuthority({
        connectionString: url,
        confirmDatabase: names.rollback,
        beforeCommit: async () => {
          throw new Error("T14 injected failure");
        },
      }),
      /T14 injected failure/,
    );

    const after = await stockSnapshot(client);
    assert.deepEqual(after, before);
    assert.equal(after.trigger, 1);
    assert.ok(after.drift > 0);
  });
}

async function verifyDrain(url) {
  migrate(url);
  await withClient(url, async (client) => {
    await seedStock(client);
  });

  const legacy = new pg.Client({ connectionString: url });
  await legacy.connect();
  let open = true;
  try {
    await legacy.query("BEGIN");
    await legacy.query(
      `UPDATE public."StockSucursal"
       SET "stockDisponibleUnits" = "stockDisponibleUnits" - 2
       WHERE "productoId" = (
         SELECT MIN("id") FROM public."Producto"
       )
       AND "sucursalId" = (
         SELECT MIN("id") FROM public."Sucursal"
       )`,
    );
    await legacy.query(
      `UPDATE public."Producto"
       SET "stockDisponibleUnits" = "stockDisponibleUnits" - 2
       WHERE "id" = (SELECT MIN("id") FROM public."Producto")`,
    );

    const before = await withClient(url, stockSnapshot);
    await expectT14Rejection(
      url,
      names.drain,
      /canceling statement due to lock timeout/i,
    );
    const afterFailure = await withClient(url, stockSnapshot);
    assert.deepEqual(afterFailure, before);

    await legacy.query("ROLLBACK");
    open = false;
  } finally {
    if (open) {
      try {
        await legacy.query("ROLLBACK");
      } catch {
        // Ignore rollback failures during teardown.
      }
    }
    await legacy.end();
  }

  await compensateStockAuthority({
    connectionString: url,
    confirmDatabase: names.drain,
  });
  await withClient(url, async (client) => {
    const after = await stockSnapshot(client);
    assert.equal(after.trigger, 0);
    assert.equal(after.drift, 0);
  });
}

async function verifyIncompatible(url) {
  migrate(url);
  await withClient(url, async (client) => {
    await client.query(
      `UPDATE public."StockAutoridad" SET "modo" = 'DB_PROJECTION' WHERE "id" = 1`,
    );
    await client.query(
      'DROP TRIGGER "trg_sync_producto_stock" ON public."StockSucursal"',
    );
    const before = await stockSnapshot(client);
    assert.deepEqual(before.capability, [{ id: 1, modo: "DB_PROJECTION" }]);
    assert.equal(before.trigger, 0);

    await expectT14Rejection(
      url,
      names.incompatible,
      /capability and projection state are incompatible/,
    );

    assert.deepEqual(await stockSnapshot(client), before);
  });
}

async function verifyCapabilityLocks(url) {  migrate(url);
  const holder = new pg.Client({ connectionString: url });
  const waiter = new pg.Client({ connectionString: url });
  await holder.connect();
  await waiter.connect();
  try {
    await holder.query("BEGIN");
    await holder.query(
      'SELECT "modo" FROM public."StockAutoridad" WHERE "id" = 1 FOR SHARE',
    );

    await waiter.query("BEGIN");
    await waiter.query("SET LOCAL lock_timeout = '400ms'");
    await assert.rejects(
      waiter.query(
        'SELECT "modo" FROM public."StockAutoridad" WHERE "id" = 1 FOR UPDATE',
      ),
      /canceling statement due to lock timeout/i,
    );
    await waiter.query("ROLLBACK");
    await holder.query("COMMIT");

    await waiter.query("BEGIN");
    await waiter.query(
      'SELECT "modo" FROM public."StockAutoridad" WHERE "id" = 1 FOR UPDATE',
    );

    await holder.query("BEGIN");
    await holder.query("SET LOCAL lock_timeout = '400ms'");
    await assert.rejects(
      holder.query(
        'SELECT "modo" FROM public."StockAutoridad" WHERE "id" = 1 FOR SHARE',
      ),
      /canceling statement due to lock timeout/i,
    );
    await holder.query("ROLLBACK");
    await waiter.query("ROLLBACK");
  } finally {
    await holder.end();
    await waiter.end();
  }
}

const admin = new pg.Client({ connectionString: baseUrl });
await admin.connect();
const createdDatabases = [];

try {
  for (const name of Object.values(names)) {
    await createDatabase(admin, name);
    createdDatabases.push(name);
  }

  await verifyFresh(databaseUrl(names.fresh));
  await verifyRollback(databaseUrl(names.rollback));
  await verifyDrain(databaseUrl(names.drain));
  await verifyIncompatible(databaseUrl(names.incompatible));
  await verifyCapabilityLocks(databaseUrl(names.lock));

  console.log("T14 stock authority verification passed");
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
  if (cleanupErrors.length) {
    throw new AggregateError(cleanupErrors, "T14 stock authority cleanup failed");
  }
}
