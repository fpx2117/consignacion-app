// scripts/test.mjs
//
// Runner único de la suite. Existe porque `package.json` tenía 8 scripts
// temáticos de test y ningún comando que corriera la suite completa: los tests
// existían y no se ejecutaban.
//
// Modos:
//   node scripts/test.mjs                → unitarios (por defecto)
//   node scripts/test.mjs --integration  → integración (requiere TEST_DATABASE_URL)
//   node scripts/test.mjs --all          → ambos
//
// Convenciones que este runner respeta:
//
// 1. Los unitarios que importan módulos con Prisma esperan un `DATABASE_URL`
//    presente (src/lib/prisma.ts lanza al importar si falta). El repo ya usa la
//    convención de un valor dummy sin conexión real
//    (`postgresql://postgres:postgres@127.0.0.1:1/test`), así que se inyecta sólo
//    si no vino uno del entorno. Nunca se lee `.env`: eso expondría la base de
//    desarrollo a tests que no deberían tocarla.
//
// 2. Los tests de integración hacen TRUNCATE sobre tablas reales y por eso
//    exigen `TEST_DATABASE_URL` explícita. Este runner no la inventa ni la
//    completa desde `.env`; si falta, falla de forma visible.

import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const TEST_ROOTS = ["src", "scripts"];
const INTEGRATION_MARKER = ".integration.test.";
const TEST_SUFFIXES = [".test.ts", ".test.mts", ".test.mjs", ".test.tsx"];

const UNIT_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:1/test";
const UNIT_JWT_SECRET = "test-only-secret-0123456789abcdef";

const args = new Set(process.argv.slice(2));
const mode = args.has("--all")
  ? "all"
  : args.has("--integration")
    ? "integration"
    : "unit";

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      out.push(...walk(full));
    } else if (entry.isFile() && TEST_SUFFIXES.some((s) => entry.name.endsWith(s))) {
      out.push(full);
    }
  }
  return out;
}

const allFiles = TEST_ROOTS.flatMap((root) => walk(join(ROOT, root)));
const isIntegration = (file) => file.includes(INTEGRATION_MARKER);

const unit = allFiles.filter((f) => !isIntegration(f));
const integration = allFiles.filter(isIntegration);

const selected =
  mode === "unit" ? unit : mode === "integration" ? integration : allFiles;

if (selected.length === 0) {
  console.error(`[test] No se encontraron archivos de test para el modo "${mode}".`);
  process.exit(1);
}

if (mode === "integration" || mode === "all") {
  if (!process.env.TEST_DATABASE_URL) {
    console.error(
      [
        "[test] TEST_DATABASE_URL es obligatoria para los tests de integración.",
        "",
        "  Estos tests ejecutan TRUNCATE sobre tablas reales. No se completa",
        "  automáticamente desde .env para que no puedan apuntar por accidente a",
        "  una base de desarrollo o producción.",
        "",
        "  Ejemplo:",
        "    cross-env TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/consignacion_app_test npm run test:integration",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }
}

if (mode === "unit") {
  process.env.DATABASE_URL ??= UNIT_DATABASE_URL;
  process.env.JWT_SECRET ??= UNIT_JWT_SECRET;
}

const files = selected
  .map((f) => relative(ROOT, f).split(sep).join("/"))
  .sort();

const label =
  mode === "unit"
    ? "unitarios"
    : mode === "integration"
      ? "integración"
      : "unitarios + integración";

console.log(`[test] modo: ${label}`);
console.log(`[test] archivos: ${files.length} (unitarios: ${unit.length}, integración: ${integration.length})`);
console.log("");

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", "--test-reporter=spec", ...files],
  { stdio: "inherit", cwd: ROOT, env: process.env },
);

if (result.error) {
  console.error("[test] no se pudo lanzar el runner:", result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
