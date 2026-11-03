import pg from "pg";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const CAPABILITY_TABLE = 'public."StockAutoridad"';
const PROJECTION_TRIGGER = "trg_sync_producto_stock";
const DUAL_WRITE = "APP_DUAL_WRITE";

function assertSafeTarget(
  connectionString,
  confirmDatabase,
  allowProduction,
) {
  if (!connectionString) {
    throw new Error("T14 stock authority compensation requires a database URL");
  }
  const parsed = new URL(connectionString);
  const database = parsed.pathname.slice(1);
  if (confirmDatabase !== database) {
    throw new Error(
      "T14 stock authority compensation requires an exact database confirmation",
    );
  }
  if (allowProduction) {
    return;
  }
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname);
  if (!local || !/(?:^|[_-])test$/.test(database)) {
    throw new Error(
      "T14 stock authority compensation requires a confirmed local database ending in test",
    );
  }
}

function normalizeLockTimeout(lockTimeoutMs) {
  const value = Number(lockTimeoutMs);
  if (!Number.isInteger(value) || value <= 0 || value > 60_000) {
    throw new Error("T14 stock authority refused: invalid lock timeout");
  }
  return value;
}

export async function compensateStockAuthority({
  connectionString,
  confirmDatabase,
  allowProduction = false,
  lockTimeoutMs = 5_000,
  beforeCommit,
}) {
  assertSafeTarget(connectionString, confirmDatabase, allowProduction);
  const lockTimeout = normalizeLockTimeout(lockTimeoutMs);

  const client = new pg.Client({ connectionString });
  await client.connect();
  let committed = false;
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL lock_timeout = '${lockTimeout}ms'`);
    await client.query("SET LOCAL statement_timeout = '5min'");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('t14_stock_authority', 0))",
    );

    // Capability first, then the fixed stock order. The B1 writer locks the
    // capability with FOR SHARE before touching stock, so taking it later here
    // would invert the order and risk a deadlock.
    const capability = await client.query(
      `SELECT "modo" FROM ${CAPABILITY_TABLE} WHERE "id" = 1 FOR UPDATE`,
    );
    if (capability.rowCount !== 1) {
      throw new Error(
        "T14 stock authority refused: capability row is missing or duplicated",
      );
    }
    const previousMode = capability.rows[0].modo;
    if (![DUAL_WRITE, "DB_PROJECTION"].includes(previousMode)) {
      throw new Error(
        "T14 stock authority refused: unknown persisted capability mode",
      );
    }

    // Fixed lock order: StockSucursal -> Producto.
    await client.query('LOCK TABLE public."StockSucursal" IN ACCESS EXCLUSIVE MODE');
    await client.query('LOCK TABLE public."Producto" IN ACCESS EXCLUSIVE MODE');

    const initialProjection = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM pg_catalog.pg_trigger
       WHERE tgrelid = 'public."StockSucursal"'::regclass
         AND tgname = $1
         AND NOT tgisinternal`,
      [PROJECTION_TRIGGER],
    );
    const projectionWasActive = initialProjection.rows[0].count === 1;
    const startingStateAllowed =
      previousMode === DUAL_WRITE ||
      (previousMode === "DB_PROJECTION" && projectionWasActive);
    if (!startingStateAllowed) {
      throw new Error(
        "T14 stock authority refused: capability and projection state are incompatible",
      );
    }

    await client.query(
      `DROP TRIGGER IF EXISTS "${PROJECTION_TRIGGER}" ON public."StockSucursal"`,
    );
    const projection = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM pg_catalog.pg_trigger
       WHERE tgrelid = 'public."StockSucursal"'::regclass
         AND tgname = $1
         AND NOT tgisinternal`,
      [PROJECTION_TRIGGER],
    );
    if (projection.rows[0].count !== 0) {
      throw new Error(
        "T14 stock authority refused: projection trigger is still installed",
      );
    }

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

    await client.query(
      `UPDATE ${CAPABILITY_TABLE}
       SET "modo" = $1, "actualizadoEn" = CURRENT_TIMESTAMP
       WHERE "id" = 1`,
      [DUAL_WRITE],
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
        "T14 stock authority refused: reconciliation left global drift",
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
      mode: DUAL_WRITE,
      projectionTrigger: "absent",
      productCount,
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
  await compensateStockAuthority({
    connectionString,
    confirmDatabase: process.env.T14_CONFIRM_DATABASE,
    allowProduction: process.env.T14_ALLOW_PRODUCTION === "true",
  });
  console.log("T14 stock authority compensation committed");
}
