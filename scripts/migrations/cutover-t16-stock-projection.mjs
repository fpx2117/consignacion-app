import pg from "pg";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const CAPABILITY_TABLE = 'public."StockAutoridad"';
const PROJECTION_TRIGGER = "trg_sync_producto_stock";
const DUAL_WRITE = "APP_DUAL_WRITE";
const PROJECTION = "DB_PROJECTION";

function assertSafeTarget(
  connectionString,
  confirmDatabase,
  allowProduction,
  attestB1,
) {
  if (!connectionString) {
    throw new Error("T16 cutover requires a database URL");
  }
  const parsed = new URL(connectionString);
  const database = parsed.pathname.slice(1);
  if (confirmDatabase !== database) {
    throw new Error(
      "T16 cutover requires an exact database confirmation",
    );
  }
  if (allowProduction) {
    // The tool cannot detect L0 writers: an L0 instance that survives the commit
    // would double-apply stock (trigger recompute plus its own Producto write).
    if (!attestB1) {
      throw new Error(
        "T16 production cutover requires T16_ATTEST_B1=true: the fleet must be fully on B1 with zero L0 instances",
      );
    }
    return;
  }

  // Advisory: a connection string can override the host, so this is defense in
  // depth, not the barrier. The exact database confirmation is the real one.
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname);
  if (!local || !/(?:^|[_-])test$/.test(database)) {
    throw new Error(
      "T16 cutover requires a confirmed local database ending in test",
    );
  }
}

function normalizeLockTimeout(lockTimeoutMs) {
  const value = Number(lockTimeoutMs);
  if (!Number.isInteger(value) || value <= 0 || value > 60_000) {
    throw new Error("T16 cutover refused: invalid lock timeout");
  }
  return value;
}

async function triggerCount(client) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM pg_catalog.pg_trigger
     WHERE tgrelid = 'public."StockSucursal"'::regclass
       AND tgname = $1
       AND NOT tgisinternal`,
    [PROJECTION_TRIGGER],
  );
  return result.rows[0].count;
}

/**
 * Forward cutover from B1 (dual-write, trigger absent) to DB_PROJECTION.
 *
 * Mirrors the T14 compensation's safety properties: exact database confirmation,
 * local-only unless explicitly allowed, advisory lock, capability FOR UPDATE,
 * fixed table lock order, drift reconciliation and a fail-closed check of the
 * starting state. Everything happens in one transaction: either the trigger and
 * the capability change commit together, or nothing changes.
 */
export async function cutoverStockProjection({
  connectionString,
  confirmDatabase,
  allowProduction = false,
  attestB1 = false,
  lockTimeoutMs = 5_000,
  beforeCommit,
}) {
  assertSafeTarget(connectionString, confirmDatabase, allowProduction, attestB1);
  const lockTimeout = normalizeLockTimeout(lockTimeoutMs);

  const client = new pg.Client({ connectionString });
  await client.connect();
  let committed = false;
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL lock_timeout = '${lockTimeout}ms'`);
    await client.query("SET LOCAL statement_timeout = '5min'");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('t16_stock_projection', 0))",
    );

    // Capability first, then the fixed stock order: B1 writers take the
    // capability FOR SHARE before touching stock, so locking it later here
    // would invert the order and risk a deadlock.
    const capability = await client.query(
      `SELECT "modo" FROM ${CAPABILITY_TABLE} WHERE "id" = 1 FOR UPDATE`,
    );
    if (capability.rowCount !== 1) {
      throw new Error(
        "T16 cutover refused: capability row is missing or duplicated",
      );
    }
    const previousMode = capability.rows[0].modo;
    if (previousMode !== DUAL_WRITE) {
      throw new Error(
        "T16 cutover refused: starting capability must be APP_DUAL_WRITE",
      );
    }

    await client.query(
      'LOCK TABLE public."StockSucursal" IN SHARE ROW EXCLUSIVE MODE',
    );
    await client.query(
      'LOCK TABLE public."Producto" IN SHARE ROW EXCLUSIVE MODE',
    );

    if ((await triggerCount(client)) !== 0) {
      throw new Error(
        "T16 cutover refused: projection trigger is already installed",
      );
    }

    const projectionFunction = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM pg_catalog.pg_proc
       WHERE proname = 'sync_producto_stock'
         AND pronamespace = 'public'::regnamespace
         AND NOT prosecdef`,
    );
    if (projectionFunction.rows[0].count !== 1) {
      throw new Error(
        "T16 cutover refused: the public, non-definer projection function is missing or duplicated",
      );
    }

    const driftBefore = await client.query(`
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

    // Reconcile before installing the projection, so the trigger starts from a
    // state that already satisfies its invariant.
    await client.query(`
      UPDATE public."Producto" AS producto
      SET "stockDisponibleUnits" = COALESCE(agregado."disponible", 0),
          "stockConsignadoUnits" = COALESCE(agregado."consignado", 0)
      FROM (
        SELECT base."id" AS "productoId",
               SUM(stock."stockDisponibleUnits") AS "disponible",
               SUM(stock."stockConsignadoUnits") AS "consignado"
        FROM public."Producto" AS base
        LEFT JOIN public."StockSucursal" AS stock
          ON stock."productoId" = base."id"
        GROUP BY base."id"
      ) AS agregado
      WHERE producto."id" = agregado."productoId"
    `);

    await client.query(`
      CREATE TRIGGER "${PROJECTION_TRIGGER}"
      AFTER INSERT OR UPDATE OR DELETE ON public."StockSucursal"
      FOR EACH ROW EXECUTE FUNCTION public.sync_producto_stock()
    `);

    if ((await triggerCount(client)) !== 1) {
      throw new Error(
        "T16 cutover refused: projection trigger was not installed exactly once",
      );
    }

    // Functional probe: a reconciled value would pass the drift check even with
    // a broken trigger, so move one row and back, asserting the projection after
    // each step (ADR 002 step 7: entrada, salida y restitución de prueba).
    let probe = "skipped";
    const probeRow = await client.query(
      'SELECT "id", "productoId" FROM public."StockSucursal" ORDER BY "id" LIMIT 1',
    );
    if (probeRow.rowCount === 1) {
      const { id: stockId, productoId } = probeRow.rows[0];
      const assertProjected = async () => {
        const sum = (
          await client.query(
            `SELECT COALESCE(SUM("stockDisponibleUnits"), 0)::int AS total
             FROM public."StockSucursal" WHERE "productoId" = $1`,
            [productoId],
          )
        ).rows[0].total;
        const projected = (
          await client.query(
            'SELECT "stockDisponibleUnits" AS total FROM public."Producto" WHERE "id" = $1',
            [productoId],
          )
        ).rows[0].total;
        if (Number(projected) !== Number(sum)) {
          throw new Error(
            "T16 cutover refused: projection probe does not match the branch sum",
          );
        }
      };
      await client.query(
        'UPDATE public."StockSucursal" SET "stockDisponibleUnits" = "stockDisponibleUnits" + 1 WHERE "id" = $1',
        [stockId],
      );
      await assertProjected();
      await client.query(
        'UPDATE public."StockSucursal" SET "stockDisponibleUnits" = "stockDisponibleUnits" - 1 WHERE "id" = $1',
        [stockId],
      );
      await assertProjected();
      probe = "in-out";
    }

    await client.query(
      `UPDATE ${CAPABILITY_TABLE}
       SET "modo" = $1, "actualizadoEn" = CURRENT_TIMESTAMP
       WHERE "id" = 1`,
      [PROJECTION],
    );

    const drift = await client.query(`
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
    if (drift.rows[0].count !== 0) {
      throw new Error(
        "T16 cutover refused: reconciliation left global drift",
      );
    }

    if (beforeCommit) {
      await beforeCommit(client);
    }

    const productCount = (
      await client.query('SELECT COUNT(*)::int AS count FROM public."Producto"')
    ).rows[0].count;

    await client.query("COMMIT");
    committed = true;

    return {
      mode: PROJECTION,
      projectionTrigger: "present",
      productCount,
      driftBefore: driftBefore.rows[0].count,
      probe,
    };
  } catch (error) {
    if (!committed) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // The connection may already be unusable; the original error wins.
      }
    }
    throw error;
  } finally {
    await client.end();
  }
}

const isCli =
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isCli) {
  const connectionString = process.env.DATABASE_URL;
  await cutoverStockProjection({
    connectionString,
    confirmDatabase: process.env.T16_CONFIRM_DATABASE,
    allowProduction: process.env.T16_ALLOW_PRODUCTION === "true",
    attestB1: process.env.T16_ATTEST_B1 === "true",
  });
  console.log("T16 stock projection cutover committed");
}
