import assert from "node:assert/strict";
import pg from "pg";
import { createDatabase, migrate } from "./t11-test-runtime.mjs";
import { compensateStockAuthority } from "./compensate-t14-stock-authority.mjs";
import { cutoverStockProjection } from "./cutover-t16-stock-projection.mjs";

const baseUrl = process.env.TEST_DATABASE_URL;
if (!baseUrl) throw new Error("TEST_DATABASE_URL is required");

const parsed = new URL(baseUrl);
const baseName = parsed.pathname.slice(1);
const local = ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname);
if (
  !local ||
  !/(?:^|[_-])test$/.test(baseName) ||
  process.env.T16_CONFIRM_DATABASE !== baseName
) {
  throw new Error(
    "T16 cutover verification requires a confirmed local database ending in test",
  );
}

const names = {
  cutover: `${baseName}_t16_cutover_test`,
  incompatible: `${baseName}_t16_incompatible_test`,
  atomic: `${baseName}_t16_atomic_test`,
  lock: `${baseName}_t16_lock_test`,
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

function databaseName(url) {
  return new URL(url).pathname.slice(1);
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
  return {
    capability: capability.rows,
    trigger: trigger.rows[0].count,
    drift: await driftCount(client),
  };
}

async function seedStock(client) {
  const sucursales = await client.query(`
    INSERT INTO "Sucursal" ("nombre", "esPrincipal", "updatedAt")
    VALUES ('T16 A', true, now()), ('T16 B', false, now())
    RETURNING "id"
  `);
  const [sucursalA, sucursalB] = sucursales.rows.map((row) => row.id);

  const producto = await client.query(`
    INSERT INTO "Producto" (
      "nombre", "precioVenta", "precioCosto", "sucursalId", "updatedAt",
      "stockDisponibleUnits", "stockConsignadoUnits"
    ) VALUES ('T16 Producto', 100, 50, $1, now(), 99, 99)
    RETURNING "id"
  `, [sucursalA]);

  // A product without branch rows: the reconciliation must leave it at 0.
  const rowless = await client.query(`
    INSERT INTO "Producto" (
      "nombre", "precioVenta", "precioCosto", "sucursalId", "updatedAt",
      "stockDisponibleUnits", "stockConsignadoUnits"
    ) VALUES ('T16 Sin Sucursal', 100, 50, $1, now(), 7, 3)
    RETURNING "id"
  `, [sucursalA]);

  const stocks = await client.query(`
    INSERT INTO "StockSucursal" (
      "productoId", "sucursalId", "stockDisponibleUnits", "stockConsignadoUnits"
    ) VALUES ($1, $2, 5, 0), ($1, $3, 5, 0)
    RETURNING "id"
  `, [producto.rows[0].id, sucursalA, sucursalB]);

  // With the historical trigger active, the inserts above already projected
  // Producto = 10. Diverge it on purpose so the fixture has real drift to repair.
  await client.query(
    `UPDATE public."Producto"
     SET "stockDisponibleUnits" = 99, "stockConsignadoUnits" = 99
     WHERE "id" = $1`,
    [producto.rows[0].id],
  );

  return {
    productoId: producto.rows[0].id,
    rowlessProductoId: rowless.rows[0].id,
    stockAId: stocks.rows[0].id,
    stockBId: stocks.rows[1].id,
  };
}

async function compensate(url, lockTimeoutMs = 2_000) {
  return compensateStockAuthority({
    connectionString: url,
    confirmDatabase: databaseName(url),
    lockTimeoutMs,
  });
}

async function cutover(url, lockTimeoutMs = 2_000) {
  return cutoverStockProjection({
    connectionString: url,
    confirmDatabase: databaseName(url),
    lockTimeoutMs,
  });
}

async function verifyCutoverAndRollback(url) {
  migrate(url);
  await withClient(url, async (client) => {
    // Fresh schema: the historical trigger is installed and the capability is
    // APP_DUAL_WRITE, which is the incompatible state B1 refuses to run in.
    let snapshot = await stockSnapshot(client);
    assert.deepEqual(snapshot.capability, [{ id: 1, modo: "APP_DUAL_WRITE" }]);
    assert.equal(snapshot.trigger, 1);

    const fixture = await seedStock(client);
    assert.equal((await driftCount(client)) > 0, true);

    // Reach B1: the compensation drops the trigger and reconciles.
    await compensate(url);
    snapshot = await stockSnapshot(client);
    assert.deepEqual(snapshot.capability, [{ id: 1, modo: "APP_DUAL_WRITE" }]);
    assert.equal(snapshot.trigger, 0);
    assert.equal(snapshot.drift, 0);

    // Drift introduced while in B1 must be repaired by the cutover and reported.
    await client.query(
      'UPDATE public."Producto" SET "stockDisponibleUnits" = 42 WHERE "id" = $1',
      [fixture.productoId],
    );
    assert.equal(await driftCount(client), 1);

    // Forward cutover: B1 dual-write -> DB_PROJECTION with the trigger back.
    const result = await cutover(url);
    assert.equal(result.mode, "DB_PROJECTION");
    assert.equal(result.probe, "in-out");
    assert.equal(result.driftBefore > 0, true);
    snapshot = await stockSnapshot(client);
    assert.deepEqual(snapshot.capability, [{ id: 1, modo: "DB_PROJECTION" }]);
    assert.equal(snapshot.trigger, 1);
    assert.equal(snapshot.drift, 0);

    // A product without branch rows is reconciled to 0, not left untouched.
    const rowless = await client.query(
      'SELECT "stockDisponibleUnits", "stockConsignadoUnits" FROM public."Producto" WHERE "id" = $1',
      [fixture.rowlessProductoId],
    );
    assert.deepEqual(rowless.rows[0], {
      stockDisponibleUnits: 0,
      stockConsignadoUnits: 0,
    });

    const projected = async () => {
      const row = await client.query(
        'SELECT "stockDisponibleUnits" AS disponible FROM public."Producto" WHERE "id" = $1',
        [fixture.productoId],
      );
      return row.rows[0].disponible;
    };

    // Entry, exit and restitution are projected by the trigger alone.
    assert.equal(await projected(), 10);
    await client.query(
      'UPDATE public."StockSucursal" SET "stockDisponibleUnits" = "stockDisponibleUnits" + 4 WHERE "id" = $1',
      [fixture.stockAId],
    );
    assert.equal(await projected(), 14);
    await client.query(
      'UPDATE public."StockSucursal" SET "stockDisponibleUnits" = "stockDisponibleUnits" - 6 WHERE "id" = $1',
      [fixture.stockAId],
    );
    assert.equal(await projected(), 8);
    await client.query(
      'UPDATE public."StockSucursal" SET "stockDisponibleUnits" = "stockDisponibleUnits" + 2 WHERE "id" = $1',
      [fixture.stockAId],
    );
    assert.equal(await projected(), 10);
    assert.equal(await driftCount(client), 0);

    // Concurrent writers on different branches: the whole point of the cutover is
    // that the projection stays equal to the branch sum under concurrency.
    const concurrentA = new pg.Client({ connectionString: url });
    const concurrentB = new pg.Client({ connectionString: url });
    await concurrentA.connect();
    await concurrentB.connect();
    try {
      await concurrentA.query("BEGIN");
      await concurrentB.query("BEGIN");
      await concurrentA.query(
        'UPDATE public."StockSucursal" SET "stockDisponibleUnits" = "stockDisponibleUnits" - 2 WHERE "id" = $1',
        [fixture.stockAId],
      );
      const blocked = concurrentB.query(
        'UPDATE public."StockSucursal" SET "stockDisponibleUnits" = "stockDisponibleUnits" - 3 WHERE "id" = $1',
        [fixture.stockBId],
      );
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 150));
      await concurrentA.query("COMMIT");
      await blocked;
      await concurrentB.query("COMMIT");
    } finally {
      await concurrentA.query("ROLLBACK").catch(() => undefined);
      await concurrentB.query("ROLLBACK").catch(() => undefined);
      await concurrentA.end();
      await concurrentB.end();
    }
    const concurrentDrift = await driftCount(client);
    assert.equal(
      concurrentDrift,
      0,
      "T16 bloqueado: la proyección por SUM pierde actualizaciones con writers " +
        `concurrentes en sucursales distintas (drift=${concurrentDrift}). ` +
        "DB_PROJECTION no es seguro hasta que la proyección aplique deltas en " +
        "lugar de recomputar la suma.",
    );
    assert.equal(await projected(), 5);

    // Rollback: compensation goes back to B1 from DB_PROJECTION.
    await compensate(url);
    snapshot = await stockSnapshot(client);
    assert.deepEqual(snapshot.capability, [{ id: 1, modo: "APP_DUAL_WRITE" }]);
    assert.equal(snapshot.trigger, 0);
    assert.equal(snapshot.drift, 0);
    assert.equal(await projected(), 10);
  });
}

async function verifyIncompatible(url) {
  migrate(url);
  await withClient(url, async (client) => {
    await compensate(url);

    // Starting capability must be APP_DUAL_WRITE.
    await client.query(
      `UPDATE public."StockAutoridad" SET "modo" = 'DB_PROJECTION' WHERE "id" = 1`,
    );
    const before = await stockSnapshot(client);
    await assert.rejects(cutover(url), /starting capability must be APP_DUAL_WRITE/);
    assert.deepEqual(await stockSnapshot(client), before);

    // The projection trigger must be absent.
    await client.query(
      `UPDATE public."StockAutoridad" SET "modo" = 'APP_DUAL_WRITE' WHERE "id" = 1`,
    );
    await client.query(`
      CREATE TRIGGER "trg_sync_producto_stock"
      AFTER INSERT OR UPDATE OR DELETE ON public."StockSucursal"
      FOR EACH ROW EXECUTE FUNCTION public.sync_producto_stock()
    `);
    const withTrigger = await stockSnapshot(client);
    await assert.rejects(cutover(url), /projection trigger is already installed/);
    assert.deepEqual(await stockSnapshot(client), withTrigger);
  });
}

async function verifyAtomicity(url) {
  migrate(url);
  await withClient(url, async (client) => {
    await compensate(url);
    const before = await stockSnapshot(client);

    // beforeCommit runs after the trigger is created and the capability is
    // flipped, so a failure there proves the whole transition rolls back.
    await assert.rejects(
      cutoverStockProjection({
        connectionString: url,
        confirmDatabase: databaseName(url),
        lockTimeoutMs: 2_000,
        beforeCommit: async () => {
          throw new Error("injected failure");
        },
      }),
      /injected failure/,
    );

    assert.deepEqual(await stockSnapshot(client), before);
  });
}

async function verifyGuards() {
  // Production requires an explicit B1 attestation: the tool cannot detect L0.
  await assert.rejects(
    cutoverStockProjection({
      connectionString: baseUrl,
      confirmDatabase: baseName,
      allowProduction: true,
      attestB1: false,
    }),
    /T16_ATTEST_B1=true/,
  );

  // Exact database confirmation.
  await assert.rejects(
    cutoverStockProjection({
      connectionString: baseUrl,
      confirmDatabase: "some_other_database",
    }),
    /exact database confirmation/,
  );

  // Lock timeout is validated before connecting.
  await assert.rejects(
    cutoverStockProjection({
      connectionString: baseUrl,
      confirmDatabase: baseName,
      lockTimeoutMs: 0,
    }),
    /invalid lock timeout/,
  );
}

async function verifyCapabilityLocks(url) {
  migrate(url);
  await compensate(url);

  const holder = new pg.Client({ connectionString: url });
  await holder.connect();
  try {
    await holder.query("BEGIN");
    await holder.query(
      'SELECT "modo" FROM public."StockAutoridad" WHERE "id" = 1 FOR SHARE',
    );

    // A B1 writer holding FOR SHARE must block the cutover's FOR UPDATE.
    await assert.rejects(cutover(url, 400), /lock timeout/i);

    const snapshot = await withClient(url, stockSnapshot);
    assert.deepEqual(snapshot.capability, [{ id: 1, modo: "APP_DUAL_WRITE" }]);
    assert.equal(snapshot.trigger, 0);

    await holder.query("COMMIT");
  } finally {
    await holder.end();
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

  await verifyCutoverAndRollback(databaseUrl(names.cutover));
  await verifyIncompatible(databaseUrl(names.incompatible));
  await verifyAtomicity(databaseUrl(names.atomic));
  await verifyCapabilityLocks(databaseUrl(names.lock));
  await verifyGuards();

  console.log("T16 stock projection cutover verification passed");
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
    throw new AggregateError(cleanupErrors, "T16 cutover cleanup failed");
  }
}
