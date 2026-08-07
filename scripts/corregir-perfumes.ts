// scripts/corregir-perfumes.ts
//
// Normaliza los productos de las sucursales cuyo rubro es "perfumeria":
// hoy sus nombres traen toda la info en una sola cadena (ej.
// "ARMAF - ODYSSEY LIMONI EDP 100ML") sin atributos estructurados.
// Este script:
//   1. Parsea cada nombre en marca, línea, concentración y ML.
//   2. Escribe esos campos en Producto.atributosExtra.
//   3. Recompone `nombre` con el formato canónico del wizard
//      (componerNombreProducto: "Marca - Línea - Concentración - ML").
//
// Es una migración de una sola vez/one-off: la lógica de parseo vive acá
// (heurística sobre datos históricos), NO en la app.
//
// Uso:
//   npx tsx scripts/corregir-perfumes.ts          # preview (no escribe)
//   npx tsx scripts/corregir-perfumes.ts --apply  # aplica
//
// Los productos que no se pueden parsear con confianza (kits, sin separador
// " - ", sin ML) se reportan y se dejan intactos.

import "dotenv/config";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { componerNombreProducto } from "@/modules/invoices/config/rubro-atributos";

const RUBRO_PERFUMERIA = "perfumeria";

// Ordenadas de la más larga a la más corta para matchear primero las
// variantes multi-palabra antes de la base "PARFUM"/"ELIXIR"/"EDP"/"EDT".
const CONCENTRACIONES = [
  "EXTRAIT DE PARFUM",
  "ELIXIR PARFUM INTENSE",
  "PARFUM INTENSE",
  "EXDP",
  "PARFUM",
  "ELIXIR",
  "EDP",
  "EDT",
] as const;

const APPLY = process.argv.includes("--apply");

// Correcciones manuales para los productos que el parser no puede resolver
// solo, con datos verificados en internet (agosto 2026). Un kit de varios
// frascos no tiene un solo ML, así que el tamaño va en `linea` y no se setea
// `ml` numérico.
const MANUALES: Record<number, { nombre: string; extra: Record<string, string> }> = {
  73: {
    // ARMAF Club de Nuit Discovery Set, 10 frascos de 10ml, EDP.
    nombre: "ARMAF - CLUB DE NUIT KIT 10x10mL - EDP",
    extra: { marca: "ARMAF", linea: "CLUB DE NUIT KIT 10x10mL", concentracion: "EDP" },
  },
  98: {
    // Kit 2x10ml (Asad Black + Asad Zanzibar), EDP.
    nombre: "LATTAFA - KIT ASAD BLACK & ASAD ZANZIBAR 2x10mL - EDP",
    extra: { marca: "LATTAFA", linea: "KIT ASAD BLACK & ASAD ZANZIBAR 2x10mL", concentracion: "EDP" },
  },
  126: {
    // Kit 2x100ml (Yara + Yara Candy), EDP.
    nombre: "LATTAFA - KIT YARA & YARA CANDY 2x100mL - EDP",
    extra: { marca: "LATTAFA", linea: "KIT YARA & YARA CANDY 2x100mL", concentracion: "EDP" },
  },
  185: {
    // Xerjoff Erba Pura es oficialmente EDP (no Extrait).
    nombre: "XERJOFF - ERBA PURA - EDP - 100",
    extra: { marca: "XERJOFF", linea: "ERBA PURA", concentracion: "EDP", ml: "100" },
  },
  190: {
    // Maison Alhambra Salvo Elixir = EDP, tamaño común 100ml.
    nombre: "MAISON ALHAMBRA - SALVO ELIXIR - EDP - 100",
    extra: { marca: "MAISON ALHAMBRA", linea: "SALVO ELIXIR", concentracion: "EDP", ml: "100" },
  },
  213: {
    // "HAMAS" es typo de "HAWAS" (Rasasi Hawas Fire 100ml EDP).
    nombre: "RASASI - HAWAS FIRE - EDP - 100",
    extra: { marca: "RASASI", linea: "HAWAS FIRE", concentracion: "EDP", ml: "100" },
  },
};

interface PerfumeParseado {
  marca: string;
  linea: string;
  concentracion: string;
  ml: string;
}

function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsearPerfume(nombre: string): PerfumeParseado | null {
  let s = nombre.trim();
  if (!s) return null;

  // Kits y presentaciones múltiples (10U X 10ML, 2X10ML, 2X100ML) no se
  // reducen a un solo ML — se dejan como están.
  if (/KIT\b/i.test(s) || /\d+\s*[Xx]\s*\d+\s*ML/i.test(s)) return null;

  const mlMatch = s.match(/(\d+)\s*ML\s*$/i);
  if (!mlMatch) return null;
  const ml = mlMatch[1];
  let resto = s.slice(0, mlMatch.index ?? s.length).trim();

  let concentracion: string | null = null;
  for (const conc of CONCENTRACIONES) {
    const re = new RegExp(`\\s*${escaparRegex(conc)}\\s*$`, "i");
    if (re.test(resto)) {
      concentracion = conc;
      resto = resto.replace(re, " ").trim();
      break;
    }
  }
  if (!concentracion) return null;

  const idx = resto.indexOf(" - ");
  if (idx <= 0) return null;
  const marca = resto.slice(0, idx).trim();
  const linea = resto.slice(idx + 3).trim();
  if (!marca || !linea) return null;

  return { marca, linea, concentracion, ml };
}

async function main() {
  const configs = await prisma.configuracion.findMany({
    select: { sucursalId: true, rubroNegocio: true },
  });
  const sucursalesPerfumeria = configs
    .filter((c) => c.rubroNegocio === RUBRO_PERFUMERIA)
    .map((c) => c.sucursalId);

  if (sucursalesPerfumeria.length === 0) {
    console.log("No hay sucursales con rubro 'perfumeria'. Nada que hacer.");
    return;
  }

  const productos = await prisma.producto.findMany({
    where: { sucursalId: { in: sucursalesPerfumeria } },
    select: { id: true, nombre: true, sucursalId: true, atributosExtra: true },
    orderBy: { id: "asc" },
  });

  const aEditar: {
    id: number;
    nombreOriginal: string;
    extra: Record<string, string>;
    nuevoNombre: string;
  }[] = [];
  const yaOk: string[] = [];
  const noParseables: string[] = [];

  for (const p of productos) {
    const manual = MANUALES[p.id];
    if (manual) {
      aEditar.push({
        id: p.id,
        nombreOriginal: p.nombre,
        extra: manual.extra,
        nuevoNombre: manual.nombre,
      });
      continue;
    }

    const parseado = parsearPerfume(p.nombre);
    if (!parseado) {
      noParseables.push(`#${p.id} "${p.nombre}"`);
      continue;
    }

    const extra: Record<string, string> = {
      marca: parseado.marca,
      linea: parseado.linea,
      concentracion: parseado.concentracion,
      ml: parseado.ml,
    };

    const nuevoNombre = componerNombreProducto(RUBRO_PERFUMERIA, extra);
    if (!nuevoNombre) {
      noParseables.push(`#${p.id} "${p.nombre}" (sin nombre compuesto)`);
      continue;
    }

    if (p.nombre.trim() === nuevoNombre) {
      yaOk.push(`#${p.id}`);
      continue;
    }

    aEditar.push({ id: p.id, nombreOriginal: p.nombre, extra, nuevoNombre });
  }

  console.log(`Sucursales perfumería: ${sucursalesPerfumeria.join(", ")}`);
  console.log(`Productos en total: ${productos.length}`);
  console.log(`Ya en formato canónico: ${yaOk.length}`);
  console.log(`No parseables (intactos): ${noParseables.length}`);
  console.log(`A corregir: ${aEditar.length}`);
  console.log("");

  for (const e of aEditar) {
    console.log(
      `#${e.id}: "${e.nombreOriginal}"\n    -> extra=${JSON.stringify(e.extra)} nombre="${e.nuevoNombre}"`,
    );
  }

  if (noParseables.length > 0) {
    console.log("\n-- No parseables (NO se tocan) --");
    for (const np of noParseables) console.log(`  ${np}`);
  }

  if (!APPLY) {
    console.log("\nModo preview (dry-run). Pasá --apply para escribir los cambios.");
    return;
  }

  for (const e of aEditar) {
    await prisma.producto.update({
      where: { id: e.id },
      data: {
        nombre: e.nuevoNombre,
        atributosExtra: e.extra as Prisma.InputJsonValue,
      },
    });
  }
  console.log(`\nAplicados ${aEditar.length} cambios (nombre + atributosExtra).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
