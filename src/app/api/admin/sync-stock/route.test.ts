import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

// T15-I: estas dos superficies se retiraron. La prueba es estática y deliberada:
// el handler no tiene seam de inyección y agregarle uno sólo para testear una
// guarda sería peor que leer el contrato. Lo que sí se prueba es lo que importa:
// no hay import de Prisma, no hay campos de stock y no hay llamadas de escritura.
// `requireAuth` sí lee la sesión; por eso la prueba habla de escrituras de stock y
// no de "acceso a la base".

const ROUTE = "src/app/api/admin/sync-stock/route.ts";
const SCRIPT = "scripts/sync-stock.ts";
const COMPENSATION = "scripts/migrations/compensate-t14-stock-authority.mjs";

async function readSource(path: string) {
  return readFile(resolve(path), "utf8");
}

test("sync-stock route authenticates but never writes stock", async () => {
  const source = await readSource(ROUTE);

  assert.doesNotMatch(source, /@\/lib\/prisma/);
  assert.doesNotMatch(source, /prisma\./);
  assert.doesNotMatch(source, /producto\.(update|updateMany|upsert)/);
  assert.doesNotMatch(source, /stockSucursal\./);
  assert.doesNotMatch(source, /stockDisponibleUnits|stockConsignadoUnits|StockAutoridad/);
  assert.doesNotMatch(source, /revalidateTag|after\(/);

  assert.match(source, /requireAuth\(\)/);
  assert.match(source, /requireRole\(auth\.user, \["ADMIN"\]\)/);
  assert.match(source, /status: 403/);
  assert.match(source, /status: 410/);
  assert.ok(
    source.includes(COMPENSATION),
    "the refusal must point at the T14 compensation",
  );
  assert.match(source, /DB_PROJECTION/);
});

test("sync-stock script refuses instead of writing stock", async () => {
  const source = await readSource(SCRIPT);

  assert.doesNotMatch(source, /@prisma\/client|@prisma\/adapter-pg|dotenv/);
  assert.doesNotMatch(source, /producto\.findMany|producto\.update/);
  assert.doesNotMatch(source, /stockSucursal\./);
  assert.doesNotMatch(source, /new pg\.|PrismaClient|PrismaPg/);

  assert.match(source, /process\.exit\(2\)/);
  assert.match(source, /SUM\(StockSucursal\)/);
  assert.match(source, /DB_PROJECTION/);
  assert.ok(
    source.includes(COMPENSATION),
    "the refusal must point at the T14 compensation",
  );
});
