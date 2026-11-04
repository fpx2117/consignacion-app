// Verifica que el estado posterior a las migraciones sea siempre compatible con
// la autoridad de stock:
//
//   - base nueva  -> APP_DUAL_WRITE sin trigger de proyección
//   - base cortada -> DB_PROJECTION con el trigger intacto
//
// La migración 20261101050000_align_fresh_install_stock_authority es condicional,
// así que se ejercita el SQL contra los dos estados además del `migrate deploy`
// real sobre una base vacía.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";

import { createDatabase, migrate } from "./t11-test-runtime.mjs";

const baseUrl = process.env.TEST_DATABASE_URL;
if (!baseUrl) throw new Error("TEST_DATABASE_URL is required");

const parsed = new URL(baseUrl);
const baseName = parsed.pathname.slice(1);
const local = ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname);
if (
  !local ||
  !/(?:^|[_-])test$/.test(baseName) ||
  process.env.STOCK_BOOTSTRAP_CONFIRM_DATABASE !== baseName
) {
  throw new Error(
    "Stock bootstrap verification requires a confirmed local database ending in test",
  );
}

const MIGRATION =
  "prisma/migrations/20261101050000_align_fresh_install_stock_authority/migration.sql";
const TRIGGER_SQL = `
  CREATE TRIGGER "trg_sync_producto_stock"
  AFTER INSERT OR UPDATE OR DELETE ON public."StockSucursal"
  FOR EACH ROW EXECUTE FUNCTION public.sync_producto_stock()
`;

const names = {
  fresh: `${baseName}_stock_bootstrap_fresh_test`,
  dual: `${baseName}_stock_bootstrap_dual_test`,
  projection: `${baseName}_stock_bootstrap_projection_test`,
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

async function state(client) {
  const capability = await client.query(
    'SELECT "modo" FROM public."StockAutoridad" WHERE "id" = 1',
  );
  const trigger = await client.query(`
    SELECT COUNT(*)::int AS count
    FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public."StockSucursal"'::regclass
      AND NOT tgisinternal
  `);
  return {
    mode: capability.rows[0]?.modo ?? null,
    triggers: trigger.rows[0]?.count ?? 0,
  };
}

async function resetCapability(client, mode) {
  await client.query(
    'UPDATE public."StockAutoridad" SET "modo" = $1 WHERE "id" = 1',
    [mode],
  );
}

async function ensureTrigger(client) {
  const current = await state(client);
  if (current.triggers === 0) await client.query(TRIGGER_SQL);
}

async function main() {
  const admin = new pg.Client({ connectionString: baseUrl });
  await admin.connect();
  try {
    for (const name of Object.values(names)) {
      await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    }

    // 1. `migrate deploy` real sobre una base vacía: el estado debe ser usable.
    await createDatabase(admin, names.fresh);
    migrate(databaseUrl(names.fresh));
    await withClient(databaseUrl(names.fresh), async (client) => {
      assert.deepEqual(await state(client), {
        mode: "APP_DUAL_WRITE",
        triggers: 0,
      });
    });

    // 2. La migración sólo retira el trigger cuando la capacidad sigue en
    //    APP_DUAL_WRITE, y es idempotente.
    await createDatabase(admin, names.dual);
    migrate(databaseUrl(names.dual));
    await withClient(databaseUrl(names.dual), async (client) => {
      await resetCapability(client, "APP_DUAL_WRITE");
      await ensureTrigger(client);
      assert.deepEqual(await state(client), {
        mode: "APP_DUAL_WRITE",
        triggers: 1,
      });

      const sql = await readFile(MIGRATION, "utf8");
      await client.query(sql);
      assert.deepEqual(await state(client), {
        mode: "APP_DUAL_WRITE",
        triggers: 0,
      });

      await client.query(sql);
      assert.deepEqual(await state(client), {
        mode: "APP_DUAL_WRITE",
        triggers: 0,
      });
    });

    // 3. En una base ya cortada el trigger es la proyección: no se toca.
    await createDatabase(admin, names.projection);
    migrate(databaseUrl(names.projection));
    await withClient(databaseUrl(names.projection), async (client) => {
      await resetCapability(client, "DB_PROJECTION");
      await ensureTrigger(client);

      const sql = await readFile(MIGRATION, "utf8");
      await client.query(sql);
      assert.deepEqual(await state(client), {
        mode: "DB_PROJECTION",
        triggers: 1,
      });

      // Un `migrate deploy` posterior tampoco lo retira.
      migrate(databaseUrl(names.projection));
      assert.deepEqual(await state(client), {
        mode: "DB_PROJECTION",
        triggers: 1,
      });
    });
  } finally {
    for (const name of Object.values(names)) {
      await admin
        .query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
        .catch(() => undefined);
    }
    await admin.end();
  }
}

main()
  .then(() => {
    console.log("Stock authority bootstrap verification passed");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
