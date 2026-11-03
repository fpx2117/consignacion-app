import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import test from "node:test";

// Guarda de inventario de T15-I.
//
// Invariante: los campos globales de stock de Producto sólo se mueven por delta
// en el puente B1 (`stock-authority.ts`), o los escribe el trigger de proyección
// en DB_PROJECTION. Ninguna herramienta de reparación puede asignarlos de forma
// absoluta.
//
// Alcance:
// - Escrituras Prisma (`producto.update|updateMany|upsert`) en los archivos de
//   producción `.ts/.tsx/.mts` de `src/` y `scripts/`. Se excluyen tests y
//   fixtures: siembran deriva a propósito.
// - SQL crudo de `scripts/` y `src/` (`UPDATE|INSERT ... "Producto" ... stock`),
//   porque los reparadores del repo son `.mjs`.
// - Los `create` quedan fuera a propósito: inicializan una fila nueva, sin
//   representación previa de la que divergir, y los cubren las integraciones de
//   T15-F/T15-G.
// - Fuera del alcance: clientes Prisma renombrados, SQL armado por concatenación
//   y datos que llegan ya construidos desde otra función. Eso queda para la
//   revisión manual del rollout.

const AUTHORITY_MODULE = "src/modules/inventory/stock-authority.ts";
const T14_TOOLING = [
  "scripts/migrations/compensate-t14-stock-authority.mjs",
  "scripts/migrations/verify-t14-stock-authority.mjs",
];
const ROOTS = ["src", "scripts"];
const NON_SOURCE = [
  /\.test\.[^.]+$/,
  /\.integration-fixture\.[^.]+$/,
  /\.d\.ts$/,
];
const PRODUCTO_WRITE = /\bproducto\.(?:update|updateMany|upsert)\s*\(/g;
const STOCK_KEY = /stock(?:Disponible|Consignado)Units\s*:\s*/g;
const STOCK_ASSIGNMENT =
  /stock(?:Disponible|Consignado)Units\s*:\s*(?!\s*(?:true|false)\b)/;
const RAW_STOCK_WRITE =
  /(?:UPDATE|INSERT\s+INTO)[\s\S]{0,400}?"Producto"[\s\S]{0,400}?stock(?:Disponible|Consignado)Units|producto\.(?:update|updateMany|upsert)\s*\([\s\S]{0,800}?stock(?:Disponible|Consignado)Units/i;

async function listSources(directory: string, pattern: RegExp): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listSources(fullPath, pattern)));
      continue;
    }
    if (!pattern.test(entry.name)) continue;
    const path = relative(process.cwd(), fullPath).replaceAll("\\", "/");
    if (NON_SOURCE.some((excluded) => excluded.test(path))) continue;
    files.push(path);
  }
  return files;
}

function skipLiteral(source: string, start: number): number {
  const quote = source[start];
  for (let index = start + 1; index < source.length; index++) {
    if (source[index] === "\\") {
      index++;
      continue;
    }
    if (source[index] === quote) return index;
  }
  return source.length - 1;
}

function readCall(source: string, openParen: number): string {
  let depth = 0;
  for (let index = openParen; index < source.length; index++) {
    const char = source[index];
    if (char === '"' || char === "'" || char === "`") {
      index = skipLiteral(source, index);
      continue;
    }
    if (char === "(") depth++;
    else if (char === ")") {
      depth--;
      if (depth === 0) return source.slice(openParen, index + 1);
    }
  }
  return source.slice(openParen);
}

function writeBody(call: string): string {
  // `select`/`where` pueden mencionar el campo sin escribirlo; el bloque `data:`
  // delimita la escritura. Si no existe (upsert usa create/update), se usa todo.
  const dataAt = call.indexOf("data:");
  return dataAt === -1 ? call : call.slice(dataAt);
}

function spreadIdentifiers(body: string): Array<string | null> {
  const identifiers: Array<string | null> = [];
  for (const match of body.matchAll(/\.\.\./g)) {
    const after = body.slice((match.index ?? 0) + 3);
    const identifier = after.match(/^\s*([A-Za-z_$][\w$]*)/);
    identifiers.push(identifier ? identifier[1] : null);
  }
  return identifiers;
}

function computedSpreadMentionsStock(body: string): boolean {
  for (const match of body.matchAll(/\.\.\.\s*(?!\s*[A-Za-z_$])/g)) {
    const operand = body.slice(match.index ?? 0, (match.index ?? 0) + 200);
    if (STOCK_ASSIGNMENT.test(operand)) return true;
  }
  return false;
}

// El schema de actualización no expone `stockConsignadoUnits` (verificado por
// `validators/producto.ts` en el test de abajo), así que excluir
// `stockDisponibleUnits` del spread alcanza para que el `data:` no escriba stock.
function spreadDeclaredWithoutStock(
  source: string,
  identifier: string,
): boolean {
  const spread = new RegExp(
    String.raw`\.\.\.\s*${identifier.replace(/[$]/g, "\\$&")}\b`,
  );
  for (const match of source.matchAll(/const\s*\{([^}]*)\}\s*=/g)) {
    const pattern = match[1];
    if (!spread.test(pattern)) continue;
    if (!/stockDisponibleUnits/.test(pattern)) continue;
    return true;
  }
  return false;
}

function passesDataIndirectly(body: string): boolean {
  for (const match of body.matchAll(/data:\s*([^\s])/g)) {
    if (match[1] !== "{") return true;
  }
  return false;
}

export function productoStockFindings(path: string, source: string): string[] {
  const findings: string[] = [];
  const isAuthority = path === AUTHORITY_MODULE;

  for (const match of source.matchAll(PRODUCTO_WRITE)) {
    const openParen = (match.index ?? 0) + match[0].length - 1;
    const body = writeBody(readCall(source, openParen));

    if (isAuthority) {
      if (!STOCK_ASSIGNMENT.test(body)) continue;
      for (const key of body.matchAll(STOCK_KEY)) {
        const value = body.slice(key.index ?? 0, (key.index ?? 0) + 60);
        if (
          !/stock(?:Disponible|Consignado)Units\s*:\s*\{\s*(?:increment|decrement)\s*:/.test(
            value,
          )
        ) {
          findings.push(
            `${path}: absolute Producto stock assignment; only deltas are allowed`,
          );
          break;
        }
      }
      continue;
    }

    if (STOCK_ASSIGNMENT.test(body)) {
      findings.push(`${path}: writes global Producto stock outside B1`);
    }

    if (passesDataIndirectly(body)) {
      findings.push(
        `${path}: passes data indirectly; cannot prove stock is excluded`,
      );
    }

    for (const identifier of spreadIdentifiers(body)) {
      if (!identifier) continue;
      if (!spreadDeclaredWithoutStock(source, identifier)) {
        findings.push(
          `${path}: spread ...${identifier} may carry global Producto stock`,
        );
      }
    }

    if (computedSpreadMentionsStock(body)) {
      findings.push(`${path}: computed spread may carry global Producto stock`);
    }
  }

  return findings;
}

test("the scan flags direct, spread, indirect and absolute stock writers", () => {
  const direct = productoStockFindings(
    "src/x.ts",
    `await prisma.producto.update({ where: { id: 1 }, data: { stockDisponibleUnits: 3 } });`,
  );
  assert.equal(direct.length, 1);

  const bothFields = productoStockFindings(
    "src/x.ts",
    `const { stockDisponibleUnits: d, stockConsignadoUnits: c, ...rest } = parsed.data;
await prisma.producto.update({ where: { id }, data: { ...rest } });`,
  );
  assert.deepEqual(bothFields, []);

  const oneFieldOnly = productoStockFindings(
    "src/x.ts",
    `const { otro, ...rest } = parsed.data;
await prisma.producto.update({ where: { id }, data: { ...rest } });`,
  );
  assert.equal(oneFieldOnly.length, 1);

  // Forma de PUT /api/productos/[id]: si se quita el destructuring que excluye
  // el stock, el spread lo reintroduce y el escaneo debe fallar aunque el
  // update no nombre el campo.
  const silentSpread = productoStockFindings(
    "src/x.ts",
    `const productoData = parsed.data;
await prisma.producto.update({ where: { id }, data: { ...productoData, nombre } });`,
  );
  assert.equal(silentSpread.length, 1);

  const indirect = productoStockFindings(
    "src/x.ts",
    `const productoData = parsed.data;
await prisma.producto.update({ where: { id }, data: productoData });`,
  );
  assert.equal(indirect.length, 1);

  const computedSpread = productoStockFindings(
    "src/x.ts",
    `await prisma.producto.update({ where: { id }, data: { ...(flag ? { stockDisponibleUnits: 1 } : {}) } });`,
  );
  // Disparan las dos reglas: la clave literal y el spread calculado.
  assert.equal(computedSpread.length, 2);

  // Forma real de scripts/corregir-datos-catalogo.ts: spread condicional de un
  // literal sin campos de stock.
  const conditionalLiteral = productoStockFindings(
    "src/x.ts",
    `await prisma.producto.update({ where: { id }, data: { ...(flag ? { nombre } : {}) } });`,
  );
  assert.deepEqual(conditionalLiteral, []);

  const readOnly = productoStockFindings(
    "src/x.ts",
    `await prisma.producto.update({ where: { stockDisponibleUnits: { gte: 1 } }, data: { nombre: "x" }, select: { stockDisponibleUnits: true } });`,
  );
  assert.deepEqual(readOnly, []);

  const authorityDelta = productoStockFindings(
    AUTHORITY_MODULE,
    `await client.producto.update({ where: { id }, data: { stockDisponibleUnits: { increment: 2 } } });`,
  );
  assert.deepEqual(authorityDelta, []);

  const authorityAbsolute = productoStockFindings(
    AUTHORITY_MODULE,
    `await client.producto.update({ where: { id }, data: { stockDisponibleUnits: total } });`,
  );
  assert.equal(authorityAbsolute.length, 1);
});

test("the repository only moves global Producto stock through the authority", async () => {
  const files = (
    await Promise.all(
      ROOTS.map((root) => listSources(resolve(root), /\.(?:ts|tsx|mts)$/)),
    )
  ).flat();
  assert.ok(files.length > 50, "the inventory scan must cover the source tree");

  const findings: string[] = [];
  for (const path of files) {
    const source = await readFile(resolve(path), "utf8");
    findings.push(...productoStockFindings(path, source));
  }

  assert.deepEqual(
    findings,
    [],
    `Producto stock must move only through ${AUTHORITY_MODULE}: ${findings.join("; ")}`,
  );
});

test("raw SQL stock repairers stay inside the T14 tooling", async () => {
  const files = (
    await Promise.all(
      ROOTS.map((root) => listSources(resolve(root), /\.(?:mjs|cjs|js)$/)),
    )
  ).flat();
  assert.ok(files.length > 0, "the SQL scan must find scripts");

  const offenders: string[] = [];
  for (const path of files) {
    if (T14_TOOLING.includes(path)) continue;
    const source = await readFile(resolve(path), "utf8");
    if (RAW_STOCK_WRITE.test(source)) offenders.push(path);
  }

  assert.deepEqual(
    offenders,
    [],
    `raw SQL Producto stock writes belong to the T14 tooling: ${offenders.join(", ")}`,
  );
});

test("the authority module never recomputes StockSucursal sums", async () => {
  const source = await readFile(resolve(AUTHORITY_MODULE), "utf8");
  assert.doesNotMatch(source, /\.aggregate\(|\.groupBy\(/);
  assert.doesNotMatch(source, /\$executeRaw|\$queryRawUnsafe/);
});

test("product update input cannot carry the consigned stock field", async () => {
  const source = await readFile(
    resolve("src/lib/validators/producto.ts"),
    "utf8",
  );
  // Si este schema expusiera stockConsignadoUnits, el spread de
  // PUT /api/productos/[id] podría reintroducirlo y el escaneo no lo vería.
  assert.doesNotMatch(source, /stockConsignadoUnits/);
});
