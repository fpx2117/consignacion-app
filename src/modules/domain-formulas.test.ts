import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import test from "node:test";

// Guarda de inventario de T17-B.
//
// Estas dos fórmulas vivían repetidas en once lugares (rutas, dashboard, PDF y
// UI). Ahora la definición vive en un módulo puro por fórmula. Este test falla si
// alguien vuelve a escribirla inline, aunque sea en varias líneas.
//
// Fuera del alcance: tests y fixtures (pueden citar la fórmula como dato).

const UNITS_MODULE = "src/modules/consignaciones/units.ts";
const MARKUP_MODULE = "src/modules/pricing/consignment-markup.ts";
const ROOTS = ["src"];
const NON_SOURCE = [
  /\.test\.[^.]+$/,
  /\.integration-fixture\.[^.]+$/,
  /\.d\.ts$/,
];

const PENDING_UNITS_SOURCE = String.raw`unitsEntregadas\s*-\s*[\w.]*unitsVendidasAcum\s*-\s*[\w.]*unitsDevueltasAcum`;
const CONSIGNMENT_MARKUP_SOURCE = String.raw`\(\s*1\s*\+\s*[\w.]*(?:porcentajeAumento|porcentajeConsignacion)[\w.]*\s*\/\s*100\s*\)`;
// Ganancia de una línea liquidada escrita a mano: precio × unidades − descuento −
// costo. La forma exacta que estaba repetida en el PDF de consignaciones.
const LINE_PROFIT_SOURCE = String.raw`\*\s*[\w.]*units\w*\s*-\s*[\w.]*desc\w*\s*-\s*[\w.]*cost\w*`;

function findFormulas(path: string, source: string): string[] {
  const findings: string[] = [];
  const pendingAllowed = path === UNITS_MODULE;
  const markupAllowed = path === MARKUP_MODULE;
  // Regex nuevos por llamada: un RegExp global compartido conserva `lastIndex`
  // y haría que el escaneo dependa del orden de ejecución.
  const pendingUnits = new RegExp(PENDING_UNITS_SOURCE, "g");
  const consignmentMarkup = new RegExp(CONSIGNMENT_MARKUP_SOURCE, "gi");
  const lineProfit = new RegExp(LINE_PROFIT_SOURCE, "gi");

  for (const match of source.matchAll(pendingUnits)) {
    if (!pendingAllowed) {
      const line = source.slice(0, match.index ?? 0).split("\n").length;
      findings.push(`${path}:${line} pending-units inline`);
    }
  }
  for (const match of source.matchAll(consignmentMarkup)) {
    if (!markupAllowed) {
      const line = source.slice(0, match.index ?? 0).split("\n").length;
      findings.push(`${path}:${line} consignment-markup inline`);
    }
  }
  // Sin excepción: la ganancia de línea no tiene una forma textual propia en su
  // módulo, así que cualquier aparición inline es una reimplementación.
  for (const match of source.matchAll(lineProfit)) {
    const line = source.slice(0, match.index ?? 0).split("\n").length;
    findings.push(`${path}:${line} line-profit inline`);
  }
  return findings;
}

async function listSources(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listSources(fullPath)));
      continue;
    }
    if (!/\.(?:ts|tsx|mts)$/.test(entry.name)) continue;
    const path = relative(process.cwd(), fullPath).replaceAll("\\", "/");
    if (NON_SOURCE.some((pattern) => pattern.test(path))) continue;
    files.push(path);
  }
  return files;
}

const PENDING_SNIPPET = `const pendiente =
  det.unitsEntregadas -
  det.unitsVendidasAcum -
  det.unitsDevueltasAcum;`;
const MARKUP_SNIPPET = `const precio = base * (1 + porcentajeAumento / 100);`;

test("las fórmulas sólo viven en sus módulos", async () => {
  const files = (
    await Promise.all(ROOTS.map((root) => listSources(resolve(root))))
  ).flat();
  assert.ok(files.length > 50, "the inventory scan must cover the source tree");

  const findings: string[] = [];
  for (const path of files) {
    const source = await readFile(resolve(path), "utf8");
    findings.push(...findFormulas(path, source));
  }

  assert.deepEqual(
    findings,
    [],
    `La fórmula debe vivir sólo en ${UNITS_MODULE} / ${MARKUP_MODULE}: ${findings.join("; ")}`,
  );
});

test("los módulos siguen siendo la única definición", async () => {
  const units = await readFile(resolve(UNITS_MODULE), "utf8");
  const markup = await readFile(resolve(MARKUP_MODULE), "utf8");
  assert.match(units, new RegExp(PENDING_UNITS_SOURCE));
  assert.match(markup, /1 \+ surcharge \/ 100/);
});

test("el escaneo detecta una reincorporación inline", () => {
  // Fuera de su módulo, cada fórmula se reporta.
  assert.equal(findFormulas("src/x.ts", PENDING_SNIPPET).length, 1);
  assert.equal(findFormulas("src/x.ts", MARKUP_SNIPPET).length, 1);
  assert.equal(
    findFormulas("src/x.ts", `${PENDING_SNIPPET}\n${MARKUP_SNIPPET}`).length,
    2,
  );

  // Cada módulo sólo está exento de su propia fórmula.
  assert.deepEqual(findFormulas(UNITS_MODULE, PENDING_SNIPPET), []);
  assert.equal(findFormulas(UNITS_MODULE, MARKUP_SNIPPET).length, 1);
  assert.deepEqual(findFormulas(MARKUP_MODULE, MARKUP_SNIPPET), []);
  assert.equal(findFormulas(MARKUP_MODULE, PENDING_SNIPPET).length, 1);

  // La ganancia de línea escrita a mano se reporta en cualquier archivo.
  assert.equal(
    findFormulas(
      "src/x.ts",
      "const g = pVenta * item.unitsVendidas - desc - cost;",
    ).length,
    1,
  );
});
