import { pathToFileURL } from "node:url";
import pg from "pg";

const SALES_SCOPE_SQL = `
  SELECT
    "sucursalId" AS "scopeId",
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE "numeroVenta" IS NULL)::int AS nulls,
    MAX("numeroVenta") AS max
  FROM "Venta"
  GROUP BY "sucursalId"
  ORDER BY "sucursalId"`;

const SALES_DUPLICATES_SQL = `
  SELECT
    "sucursalId" AS "scopeId",
    "numeroVenta" AS number,
    COUNT(*)::int AS count,
    ARRAY_AGG(id ORDER BY id) AS ids
  FROM "Venta"
  WHERE "numeroVenta" IS NOT NULL
  GROUP BY "sucursalId", "numeroVenta"
  HAVING COUNT(*) > 1
  ORDER BY "sucursalId", "numeroVenta"`;

const CONSIGNATION_SCOPE_SQL = `
  SELECT
    "clienteId" AS "scopeId",
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE "numeroFolio" IS NULL)::int AS nulls,
    MAX("numeroFolio") AS max
  FROM "Consignacion"
  GROUP BY "clienteId"
  ORDER BY "clienteId"`;

const CONSIGNATION_DUPLICATES_SQL = `
  SELECT
    "clienteId" AS "scopeId",
    "numeroFolio" AS number,
    COUNT(*)::int AS count,
    ARRAY_AGG(id ORDER BY id) AS ids
  FROM "Consignacion"
  WHERE "numeroFolio" IS NOT NULL
  GROUP BY "clienteId", "numeroFolio"
  HAVING COUNT(*) > 1
  ORDER BY "clienteId", "numeroFolio"`;

export async function auditNumbering(client) {
  let transactionStarted = false;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    transactionStarted = true;
    const salesScopes = await client.query(SALES_SCOPE_SQL);
    const salesDuplicates = await client.query(SALES_DUPLICATES_SQL);
    const consignationScopes = await client.query(CONSIGNATION_SCOPE_SQL);
    const consignationDuplicates = await client.query(
      CONSIGNATION_DUPLICATES_SQL,
    );

    return {
      ventas: {
        scopes: salesScopes.rows,
        duplicates: salesDuplicates.rows,
      },
      consignaciones: {
        scopes: consignationScopes.rows,
        duplicates: consignationDuplicates.rows,
      },
    };
  } finally {
    if (transactionStarted) await client.query("ROLLBACK");
  }
}

function requireSafeAuditUrl() {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("TEST_DATABASE_URL is required");

  const url = new URL(connectionString);
  const database = url.pathname.slice(1);
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (
    !local ||
    !/(?:^|[_-])test$/.test(database) ||
    process.env.T12_CONFIRM_DATABASE !== database
  ) {
    throw new Error(
      "T12 numbering audit requires a confirmed local database ending in test",
    );
  }
  return connectionString;
}

async function main() {
  const client = new pg.Client({ connectionString: requireSafeAuditUrl() });
  await client.connect();
  try {
    console.log(JSON.stringify(await auditNumbering(client), null, 2));
  } finally {
    await client.end();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
