// scripts/kpi-parity-compare.mjs
//
// Compara dos snapshots de scripts/kpi-parity.ts antes/después de mover la
// agregación del dashboard a SQL (M14).
//
// Criterio de aceptación:
//
//   1. `tendencia` debe ser idéntica, punto por punto, al centavo.
//   2. `top*` debe coincidir en valores (units, total, nombre) para cada producto
//      presente en ambas salidas, y estar ordenado por units descendente.
//   3. En `top*` se tolera que cambie qué producto entra cuando hay EMPATE en el
//      corte. Ese orden nunca fue determinista: la consulta original usaba
//      `findMany` sin ORDER BY, así que el desempate dependía del orden físico de
//      Postgres. La versión SQL lo hace determinista.
//   4. Cualquier diferencia de valor, o un producto que aparece/desaparece sin
//      estar empatado en el corte, es un fallo.

import { readFileSync } from "node:fs";

const [, , beforePath, afterPath] = process.argv;
if (!beforePath || !afterPath) {
  console.error("Uso: node scripts/kpi-parity-compare.mjs <before.json> <after.json>");
  process.exit(1);
}

const before = JSON.parse(readFileSync(beforePath, "utf8"));
const after = JSON.parse(readFileSync(afterPath, "utf8"));

const round2 = (n) => Math.round(n * 100) / 100;
const failures = [];
let tieChanges = 0;
let orderedDiffs = 0;

function compareStrict(path, a, b) {
  if (typeof a === "number" && typeof b === "number") {
    if (round2(a) !== round2(b)) failures.push(`${path}: ${a} != ${b}`);
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      failures.push(`${path}: largo ${a.length} != ${b.length}`);
      return;
    }
    for (let i = 0; i < a.length; i++) compareStrict(`${path}[${i}]`, a[i], b[i]);
    return;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a).sort();
    const keysB = Object.keys(b).sort();
    if (keysA.join(",") !== keysB.join(",")) {
      failures.push(`${path}: claves distintas`);
      return;
    }
    for (const key of keysA) compareStrict(`${path}.${key}`, a[key], b[key]);
    return;
  }
  if (a !== b) failures.push(`${path}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
}

function compareTop(path, listBefore, listAfter) {
  if (!Array.isArray(listBefore) || !Array.isArray(listAfter)) {
    failures.push(`${path}: no es una lista`);
    return;
  }

  for (const [label, list] of [
    ["before", listBefore],
    ["after", listAfter],
  ]) {
    if (!list.every((row, i) => i === 0 || list[i - 1].units >= row.units)) {
      failures.push(`${path}: ${label} no está ordenado por units descendente`);
    }
  }

  const mapBefore = new Map(listBefore.map((row) => [row.productoId, row]));
  const mapAfter = new Map(listAfter.map((row) => [row.productoId, row]));

  // Units del último puesto: es el umbral de empate en el corte.
  const cutoff = Math.min(
    ...[...listAfter, ...listBefore].map((row) => row.units),
    Number.POSITIVE_INFINITY,
  );

  for (const [id, row] of mapBefore) {
    const other = mapAfter.get(id);
    if (!other) {
      if (row.units === cutoff) tieChanges++;
      else failures.push(`${path}: producto ${id} (${row.units} u.) desapareció sin estar empatado`);
      continue;
    }
    if (
      row.units !== other.units ||
      round2(row.total) !== round2(other.total) ||
      row.nombre !== other.nombre
    ) {
      failures.push(
        `${path}: producto ${id} cambió — ${row.units}/${row.total} vs ${other.units}/${other.total}`,
      );
    }
  }

  for (const [id, row] of mapAfter) {
    if (mapBefore.has(id)) continue;
    if (row.units === cutoff) tieChanges++;
    else failures.push(`${path}: producto ${id} (${row.units} u.) apareció sin estar empatado`);
  }

  const idsBefore = listBefore.map((r) => r.productoId).join(",");
  const idsAfter = listAfter.map((r) => r.productoId).join(",");
  if (idsBefore !== idsAfter) orderedDiffs++;
}

for (const key of Object.keys(before)) {
  if (!(key in after)) {
    failures.push(`${key}: falta en el snapshot nuevo`);
    continue;
  }
  if (key.startsWith("tendencia")) compareStrict(key, before[key], after[key]);
  else compareTop(key, before[key], after[key]);
}

for (const key of Object.keys(after)) {
  if (!(key in before)) failures.push(`${key}: sobra en el snapshot nuevo`);
}

if (failures.length === 0) {
  const total = Object.keys(before).length;
  console.log(
    `[parity] OK — ${total} escenarios. Valores idénticos al centavo. ` +
      `Empates en el corte que cambiaron de producto: ${tieChanges}. ` +
      `Escenarios con orden distinto por empate: ${orderedDiffs}.`,
  );
  process.exit(0);
}

console.log(`[parity] FALLÓ — ${failures.length} problemas`);
for (const failure of failures.slice(0, 25)) console.log("  - " + failure);
process.exit(1);
