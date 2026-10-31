// Limpieza one-off de Producto.atributosExtra (+ nombre recompuesto) para las
// sucursales de rubro "vapes" y "perfumeria". NO cambia la lógica de la app:
// solo normaliza datos históricos ya cargados.
//
// Correcciones que aplica (todas seguras / sin pérdida de información):
//   1. trim + colapso de espacios internos en TODOS los valores string.
//   2. marca "Elfbar" / "Elfbar " -> "ELFBAR" (misma marca, 3 variantes).
//   3. concentracion "EXDP" -> "EXTRAIT DE PARFUM" (abreviatura equivalente).
//   4. Recompone `nombre` con componerNombreProducto cuando los atributos
//      limpios cambian el nombre canónico.
//
// Lo que SOLO reporta (no toca — requiere decisión del usuario):
//   - concentracion fuera del select del wizard (ELIXIR, EXTRAIT DE PARFUM,
//     PARFUM INTENSE, PARFUM/Parfum). Ver RUBRO_ATRIBUTOS_FIJOS.perfumeria.
//   - Productos duplicados (mismo nombre canónico).
// Uso:
//   npx tsx scripts/corregir-datos-catalogo.ts          # preview (dry-run)
//   npx tsx scripts/corregir-datos-catalogo.ts --apply  # escribe
import "dotenv/config";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  componerNombreProducto,
  RUBRO_ATRIBUTOS_FIJOS,
} from "@/modules/invoices/config/rubro-atributos";

const APPLY = process.argv.includes("--apply");
const RUBROS = ["vapes", "perfumeria"] as const;

const MARCA_CANONICA: Record<string, string> = {
  Elfbar: "ELFBAR",
};
const CONCENTRACION_CANONICA: Record<string, string> = {
  EXDP: "EXTRAIT DE PARFUM",
  PARFUM: "Parfum", // el select del wizard usa "Parfum" (match exacto)
};

const limpiarStr = (v: string) => v.trim().replace(/\s+/g, " ");

function limpiarExtra(extra: Record<string, unknown>): {
  limpio: Record<string, string>;
  cambios: string[];
} {
  const limpio: Record<string, string> = {};
  const cambios: string[] = [];
  for (const [k, vRaw] of Object.entries(extra)) {
    if (typeof vRaw !== "string") continue;
    let v = limpiarStr(vRaw);
    if (k === "marca" && MARCA_CANONICA[v]) v = MARCA_CANONICA[v];
    if (k === "concentracion" && CONCENTRACION_CANONICA[v])
      v = CONCENTRACION_CANONICA[v];
    if (v !== vRaw) cambios.push(`${k}: "${vRaw}" -> "${v}"`);
    limpio[k] = v;
  }
  return { limpio, cambios };
}

async function main() {
  const configs = await prisma.configuracion.findMany({
    select: { sucursalId: true, rubroNegocio: true },
  });
  const rubroPorSucursal = new Map(
    configs.map((c) => [c.sucursalId, c.rubroNegocio]),
  );
  const sucursales = configs
    .filter((c) => RUBROS.includes(c.rubroNegocio as (typeof RUBROS)[number]))
    .map((c) => c.sucursalId);

  const productos = await prisma.producto.findMany({
    where: { sucursalId: { in: sucursales } },
    select: { id: true, nombre: true, sucursalId: true, atributosExtra: true },
    orderBy: { id: "asc" },
  });

  const aEditar: {
    id: number;
    sucursalId: number;
    nombreOriginal: string;
    nuevoNombre: string | null;
    extra: Record<string, string>;
    cambios: string[];
  }[] = [];
  const concFueraDeSelect = new Set<string>();
  const nombreCanon = new Map<string, number[]>();

  const opcionesConc =
    RUBRO_ATRIBUTOS_FIJOS.perfumeria.find((a) => a.clave === "concentracion")
      ?.opciones ?? [];

  const ignorados: string[] = [];
  for (const p of productos) {
    if (p.sucursalId === null) {
      ignorados.push(`#${p.id} "${p.nombre}" (sin sucursal)`);
      continue;
    }
    if (/TEST E2E/i.test(p.nombre)) {
      ignorados.push(`#${p.id} "${p.nombre}"`);
      continue;
    }
    const rubro = rubroPorSucursal.get(p.sucursalId) ?? null;
    const extraOrig = (p.atributosExtra ?? {}) as Record<string, unknown>;
    const { limpio, cambios } = limpiarExtra(extraOrig);

    if (rubro === "perfumeria" && limpio.concentracion) {
      const c = limpio.concentracion;
      const ok = opcionesConc.some((o) => o.toLowerCase() === c.toLowerCase());
      if (!ok) concFueraDeSelect.add(c);
    }

    const nuevoNombre = componerNombreProducto(rubro, limpio);
    const nombreCambia =
      nuevoNombre !== null && nuevoNombre !== p.nombre.trim();

    if (nuevoNombre) {
      const key = nuevoNombre.toLowerCase();
      nombreCanon.set(key, [...(nombreCanon.get(key) ?? []), p.id]);
    }

    if (cambios.length > 0 || nombreCambia) {
      aEditar.push({
        id: p.id,
        sucursalId: p.sucursalId,
        nombreOriginal: p.nombre,
        nuevoNombre: nombreCambia ? nuevoNombre : null,
        extra: limpio,
        cambios,
      });
    }
  }

  console.log(`Sucursales (${RUBROS.join("/")}): ${sucursales.join(", ")}`);
  console.log(`Productos analizados: ${productos.length}`);
  console.log(`A corregir: ${aEditar.length}\n`);

  for (const e of aEditar) {
    console.log(`#${e.id} (suc ${e.sucursalId}) "${e.nombreOriginal}"`);
    for (const c of e.cambios) console.log(`    ${c}`);
    if (e.nuevoNombre) console.log(`    nombre -> "${e.nuevoNombre}"`);
  }

  if (ignorados.length > 0) {
    console.log("\n-- Productos de prueba ignorados --");
    for (const i of ignorados) console.log(`  ${i}`);
  }

  const dups = [...nombreCanon.entries()].filter(([, ids]) => ids.length > 1);
  if (dups.length > 0) {
    console.log("\n-- DUPLICADOS (revisar a mano, NO se tocan) --");
    for (const [k, ids] of dups)
      console.log(`  "${k}" -> productos #${ids.join(", #")}`);
  }

  if (concFueraDeSelect.size > 0) {
    console.log(
      "\n-- CONCENTRACIONES fuera del select del wizard (decidir: ampliar opciones en rubro-atributos.ts o unificar) --",
    );
    for (const c of concFueraDeSelect) console.log(`  ${c}`);
  }

  if (!APPLY) {
    console.log("\nDry-run. Pasá --apply para escribir.");
    return;
  }

  for (const e of aEditar) {
    await prisma.producto.update({
      where: { id: e.id },
      data: {
        atributosExtra: e.extra as Prisma.InputJsonValue,
        ...(e.nuevoNombre ? { nombre: e.nuevoNombre } : {}),
      },
    });
  }
  console.log(`\nAplicados ${aEditar.length} cambios.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
