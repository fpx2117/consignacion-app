import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import pg from "pg";

const EXPECTED_PRISMA_VERSION = "7.8.0";
const CURRENT_SCHEMA_HASH =
  "122d743a0403e77ad7e0ed9447f5b8826f2fbdbc55612d936eff004dd13c2eec";
const LEGACY_SCHEMA_HASH =
  "aa57cc1a1da585bc5ddb356095e03a94a7082dae87a2a545f96acf65a7b25570";
const T11_SCHEMA_HASH =
  "b02561d7678ce878d77ee40d0e1e46afe95441035d3e703068c40efb92b7a4c8";
const T11_MIGRATION = "20261101010000_reconcile_schema_history";
const POST_T11_MIGRATIONS = [
  "20261101020000_establish_numbering_authority",
  "20261101030000_establish_stock_authority",
];
const LEGACY_MIGRATIONS = [
  "20260225061121_new",
  "20260225175537_add_cons_price_adj",
  "20260225181221_add_card_interest",
  "20260225182349_add_product_image",
  "20260225184755_add_price_list_config",
  "20260225190045_add_advanced_branding_fields",
  "20260309120000_add_checkout_intent_phase1",
  "20260313130000_add_catalog_visits",
  "20260313162000_add_pedido_vencido_notification_type",
  "20260313200000_create_pedidos_esperados_tables",
  "20260315030000_configuracion_zona_horaria",
  "20260317103000_usuario_zona_horaria_global",
  "20260322000000_trigger_sync_producto_stock",
  "20260324000000_add_descuentos_producto",
  "20260523120000_add_storefront_content_to_branding",
  "20260630232914_add_tienda_metodo_pago",
  "20260701000000_add_proveedor_ocr_pipeline",
  "20260701010000_add_proveedor_detectado_factura",
  "20260701050000_factura_proveedor_ia_auditoria",
  "20260701060000_add_max_facturas_ocr",
  "20260701070000_add_factura_archivo_eliminado",
  "20260701234948_add_rubro_contexto_ocr",
  "20260702050740_add_proveedor_sucursal",
  "20260702223000_add_factura_item_advertencias",
  "20260705120000_add_catalogo_global_candidatos",
  "20260712130000_add_tienda_online_opt_in",
  "20260712140000_add_incluida_en_dashboard_global",
  "20260719120000_add_factura_snapshot_ia_y_rubro",
  "20260805123000_add_share_link_date_range",
];
const KNOWN_HISTORICAL_CHECKSUMS = {
  "20260523120000_add_storefront_content_to_branding": [
    "4f0afe1e06f11f05b466767060c5654d8e37b70187fa4ff82dd0df2c6383bf4c",
    "2a5acff600b9c3a7111ee86e2321375fa0c166dc4f3f0339308ad197d21d214b",
    "7cabd839ff193481b77048ba9f6cd889cdc8fe78d5986c70250ffbb289c05ac2",
    "e47f1a032d922de1e7c1df77db4f0cc34651c08df8f46f08209a253c6fe62712",
  ],
};
const requireCurrent = process.argv.includes("--require-current");
const databaseUrl = process.env.DATABASE_URL;

function runPrisma(args) {
  const prismaCli = resolve("node_modules/prisma/build/index.js");
  return spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
  });
}

function normalize(value) {
  return value.replace(/\r\n/g, "\n").trim();
}

function hash(value) {
  return createHash("sha256").update(normalize(value)).digest("hex");
}

export async function expectedChecksums() {
  const result = new Map();
  for (const name of [
    ...LEGACY_MIGRATIONS,
    T11_MIGRATION,
    ...POST_T11_MIGRATIONS,
  ]) {
    const sql = await readFile(
      join("prisma", "migrations", name, "migration.sql"),
    );
    const lf = sql.toString("utf8").replace(/\r\n/g, "\n");
    const crlf = lf.replace(/\n/g, "\r\n");
    result.set(
      name,
      new Set([
        createHash("sha256").update(sql).digest("hex"),
        createHash("sha256").update(lf).digest("hex"),
        createHash("sha256").update(crlf).digest("hex"),
        ...(KNOWN_HISTORICAL_CHECKSUMS[name] ?? []),
      ]),
    );
  }
  return result;
}

export async function validateMigrationHistory(rows) {
  const checksums = await expectedChecksums();
  const knownNames = new Set([
    ...LEGACY_MIGRATIONS,
    T11_MIGRATION,
    ...POST_T11_MIGRATIONS,
  ]);

  for (const row of rows) {
    if (!knownNames.has(row.migration_name)) {
      throw new Error(`Unknown migration history row: ${row.migration_name}`);
    }
    if (!checksums.get(row.migration_name).has(row.checksum)) {
      throw new Error(`Unsupported checksum for ${row.migration_name}`);
    }
  }

  const unresolved = rows.filter((row) => !row.finished && !row.rolled_back);
  if (unresolved.length) {
    throw new Error(
      `Unresolved failed migrations: ${unresolved
        .map((row) => row.migration_name)
        .join(", ")}`,
    );
  }

  const malformed = rows.filter((row) => row.finished && row.rolled_back);
  if (malformed.length) {
    throw new Error(
      `Malformed migration history rows: ${malformed
        .map((row) => row.migration_name)
        .join(", ")}`,
    );
  }

  const rolledBack = rows.filter((row) => row.rolled_back && !row.finished);
  const retryable = new Set([
    "20260523120000_add_storefront_content_to_branding",
    T11_MIGRATION,
    ...POST_T11_MIGRATIONS,
  ]);
  for (const row of rolledBack) {
    if (!retryable.has(row.migration_name)) {
      throw new Error(`Unexpected rolled-back row: ${row.migration_name}`);
    }
  }
  for (const name of retryable) {
    const count = rolledBack.filter((row) => row.migration_name === name).length;
    if (count > 1) {
      throw new Error(`Too many rolled-back ${name} rows: ${count}`);
    }
  }

  const successful = rows.filter((row) => row.finished && !row.rolled_back);
  for (const name of LEGACY_MIGRATIONS) {
    const count = successful.filter((row) => row.migration_name === name).length;
    if (count !== 1) {
      throw new Error(`Expected one successful ${name} row, found ${count}`);
    }
  }

  const t11Count = successful.filter(
    (row) => row.migration_name === T11_MIGRATION,
  ).length;
  if (t11Count > 1) {
    throw new Error(`Expected at most one successful T11 row, found ${t11Count}`);
  }
  const postT11Count = POST_T11_MIGRATIONS.reduce((count, name) => {
    const matches = successful.filter((row) => row.migration_name === name).length;
    if (matches > 1) {
      throw new Error(`Expected at most one successful ${name} row, found ${matches}`);
    }
    return count + matches;
  }, 0);
  const rolledBackPostT11Count = rolledBack.filter((row) =>
    POST_T11_MIGRATIONS.includes(row.migration_name),
  ).length;
  if ((postT11Count > 0 || rolledBackPostT11Count > 0) && t11Count !== 1) {
    throw new Error("Post-T11 migration exists without a successful T11 row");
  }
  if (
    successful.length !==
    LEGACY_MIGRATIONS.length + t11Count + postT11Count
  ) {
    throw new Error("Migration history contains duplicate successful rows");
  }
  return { t11Applied: t11Count === 1 };
}

async function inspectMigrationHistory() {
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const metadata = await client.query(`
      SELECT to_regclass('public._prisma_migrations') IS NOT NULL has_history,
        (SELECT COUNT(*)::int FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_type = 'BASE TABLE'
           AND table_name <> '_prisma_migrations') table_count
    `);
    const { has_history: hasHistory, table_count: tableCount } = metadata.rows[0];
    if (!hasHistory) {
      if (tableCount !== 0) {
        throw new Error(
          "Database has application tables but no Prisma migration history",
        );
      }
      return { state: "empty", t11Applied: false };
    }

    const history = await client.query(`
      SELECT migration_name, checksum,
        finished_at IS NOT NULL finished,
        rolled_back_at IS NOT NULL rolled_back
      FROM _prisma_migrations
      ORDER BY started_at
    `);
    if (history.rowCount === 0 && tableCount === 0) {
      return { state: "empty", t11Applied: false };
    }
    const { t11Applied } = await validateMigrationHistory(history.rows);
    return { state: "migrated", t11Applied };
  } finally {
    await client.end();
  }
}

async function main() {
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const version = runPrisma(["-v"]);
  if (version.status !== 0) throw new Error(version.stderr || version.stdout);
  const versionMatch = version.stdout.match(/^prisma\s*:\s*(\S+)/m);
  if (versionMatch?.[1] !== EXPECTED_PRISMA_VERSION) {
    throw new Error(
      `Expected Prisma ${EXPECTED_PRISMA_VERSION}, found ${versionMatch?.[1] ?? "unknown"}`,
    );
  }

  const history = await inspectMigrationHistory();
  if (history.state === "empty") {
    if (requireCurrent) {
      throw new Error("Database is empty after migration deployment");
    }
    console.log("T11 preflight: empty database accepted");
    return;
  }

  const directory = await mkdtemp(join(tmpdir(), "t11-preflight-"));
  const output = join(directory, "diff.sql");
  try {
    const diff = runPrisma([
      "migrate",
      "diff",
      "--from-config-datasource",
      "--to-schema",
      "prisma/schema.prisma",
      "--script",
      "--output",
      output,
    ]);
    if (diff.status !== 0) throw new Error(diff.stderr || diff.stdout);

    const sql = await readFile(output, "utf8");
    const schemaHash = hash(sql);
    if (schemaHash === CURRENT_SCHEMA_HASH) {
      if (requireCurrent && !history.t11Applied) {
        throw new Error("Current schema has no successful T11 history row");
      }
      console.log("T11 preflight: current schema accepted");
      return;
    }
    if (!requireCurrent && schemaHash === T11_SCHEMA_HASH) {
      console.log("T11 preflight: exact post-T11 schema accepted");
      return;
    }
    if (!requireCurrent && schemaHash === LEGACY_SCHEMA_HASH) {
      if (history.t11Applied) {
        throw new Error("T11 is marked applied but the schema is still legacy");
      }
      console.log("T11 preflight: exact 29-migration schema accepted");
      return;
    }

    console.error(sql);
    throw new Error(
      requireCurrent
        ? "Schema still differs after T11 deployment"
        : "Unsupported partial schema state; T11 deployment refused",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const isCli =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isCli) await main();
