// scripts/check-bundle-budget.mjs
//
// Mide el JavaScript que cada ruta carga en la primera visita y lo compara contra
// un presupuesto declarado.
//
// Por qué existe: `next build` con Turbopack no imprime la tabla de "First Load
// JS" que sí mostraba webpack. Sin ese número, cualquier decisión sobre bundle
// (o sobre migrar a Server Components) es una opinión.
//
// Cómo mide: Next genera un `*_client-reference-manifest.js` por ruta. Su campo
// `entryJSFiles` lista los chunks de cada entrada (root layout, layouts anidados y
// la página). Se toma la unión de esos chunks y se suman sus tamaños comprimidos.
//
// Uso:
//   node scripts/check-bundle-budget.mjs            # tabla + veredicto
//   node scripts/check-bundle-budget.mjs --json     # sólo JSON
//   node scripts/check-bundle-budget.mjs --top 20   # limita la tabla
//
// Requiere un build previo (`npm run build`).

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SERVER_APP = join(ROOT, ".next", "server", "app");
// Los manifests referencian "static/chunks/..." relativo a .next.
const NEXT_DIR = join(ROOT, ".next");
const BUDGET_FILE = join(ROOT, "bundle-budget.json");

if (!existsSync(SERVER_APP)) {
  console.error(
    "[bundle] No existe .next/server/app. Corré `npm run build` antes de medir.",
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const jsonOnly = args.includes("--json");
const topIndex = args.indexOf("--top");
const top = topIndex !== -1 ? Number(args[topIndex + 1]) || 15 : 15;

function findManifests(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findManifests(full));
    else if (entry.isFile() && entry.name.endsWith("_client-reference-manifest.js")) {
      out.push(full);
    }
  }
  return out;
}

function parseManifest(file) {
  const content = readFileSync(file, "utf8");
  const marker = "] = ";
  const start = content.indexOf(marker);
  if (start === -1) return null;
  const json = content.slice(start + marker.length).replace(/;\s*$/, "");
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const gzipCache = new Map();
function gzipSize(relativeChunkPath) {
  if (gzipCache.has(relativeChunkPath)) return gzipCache.get(relativeChunkPath);
  const clean = relativeChunkPath.replace(/^\/?_next\//, "").replace(/^\//, "");
  const full = join(NEXT_DIR, clean);
  let size = 0;
  try {
    size = gzipSync(readFileSync(full)).length;
  } catch {
    size = 0;
  }
  gzipCache.set(relativeChunkPath, size);
  return size;
}

const routes = [];

for (const file of findManifests(SERVER_APP)) {
  const data = parseManifest(file);
  if (!data?.entryJSFiles) continue;

  const rel = relative(SERVER_APP, file).replace(/\\/g, "/");
  // Sólo páginas: layouts, not-found y error tienen su propio manifiesto y no son
  // rutas navegables por el usuario.
  if (!rel.endsWith("/page_client-reference-manifest.js")) continue;

  const route =
    "/" +
    rel
      .replace(/_client-reference-manifest\.js$/, "")
      .replace(/\/page$/, "")
      .replace(/\((\w[\w-]*)\)/g, "")
      .replace(/\/+/g, "/")
      .replace(/^\/+/, "");

  const chunks = new Set();
  for (const list of Object.values(data.entryJSFiles)) {
    for (const chunk of list) chunks.add(chunk);
  }

  let bytes = 0;
  for (const chunk of chunks) bytes += gzipSize(chunk);

  routes.push({ route: route || "/", kb: Math.round((bytes / 1024) * 10) / 10, chunks: chunks.size });
}

routes.sort((a, b) => b.kb - a.kb);

function readJsonFile(path) {
  // Un editor en Windows puede guardar con BOM; JSON.parse no lo tolera.
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

const budget = existsSync(BUDGET_FILE) ? readJsonFile(BUDGET_FILE) : null;

const updateBaseline = args.includes("--update-baseline");

if (updateBaseline) {
  const next = {
    defaultMaxKB: budget?.defaultMaxKB ?? 350,
    maxGrowthKB: budget?.maxGrowthKB ?? 10,
    baseline: Object.fromEntries(routes.map((r) => [r.route, r.kb])),
  };
  writeFileSync(BUDGET_FILE, JSON.stringify(next, null, 2) + "\n", "utf8");
  console.log(`[bundle] baseline actualizado en bundle-budget.json (${routes.length} rutas).`);
  process.exit(0);
}

const violations = [];
if (budget) {
  const defaultMax = budget.defaultMaxKB ?? Number.POSITIVE_INFINITY;
  const maxGrowth = budget.maxGrowthKB ?? Number.POSITIVE_INFINITY;
  const baseline = budget.baseline ?? {};
  const perRoute = budget.routes ?? {};

  for (const entry of routes) {
    const absoluteMax = perRoute[entry.route] ?? defaultMax;
    if (entry.kb > absoluteMax) {
      violations.push({
        route: entry.route,
        kb: entry.kb,
        max: absoluteMax,
        reason: "supera el máximo absoluto",
      });
      continue;
    }
    const base = baseline[entry.route];
    if (typeof base === "number" && entry.kb > base + maxGrowth) {
      violations.push({
        route: entry.route,
        kb: entry.kb,
        max: Math.round((base + maxGrowth) * 10) / 10,
        reason: `creció ${Math.round((entry.kb - base) * 10) / 10} KB sobre el baseline`,
      });
    }
  }
}

if (jsonOnly) {
  console.log(
    JSON.stringify({ generatedAt: new Date().toISOString(), routes, violations }, null, 2),
  );
  process.exit(violations.length === 0 ? 0 : 1);
}

console.log(`[bundle] rutas medidas: ${routes.length} (tamaño gzip, primera carga)\n`);
console.log("  KB    chunks  ruta");
for (const entry of routes.slice(0, top)) {
  console.log(
    `${String(entry.kb).padStart(6)}  ${String(entry.chunks).padStart(6)}  ${entry.route}`,
  );
}
if (routes.length > top) console.log(`  ... y ${routes.length - top} rutas más`);

if (!budget) {
  console.log("\n[bundle] sin bundle-budget.json: sólo se reporta, no se evalúa.");
  process.exit(0);
}

if (violations.length === 0) {
  console.log(`\n[bundle] OK — ninguna ruta supera su presupuesto.`);
  process.exit(0);
}

console.log(`\n[bundle] ${violations.length} ruta(s) exceden el presupuesto:`);
for (const v of violations) {
  console.log(`  - ${v.route}: ${v.kb} KB > ${v.max} KB`);
}
process.exit(1);
