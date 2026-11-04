// scripts/kpi-parity.ts
//
// Captura la salida de las funciones de dashboard para comparar implementaciones.
//
// Uso:
//   node --import tsx scripts/kpi-parity.ts --out %TEMP%\before.json
//
// Requiere DATABASE_URL apuntando a una base con datos reales.
//
// Existe por M14: mover la agregación del dashboard a SQL no puede cambiar ni un
// número. Este script toma una foto antes y después del cambio, y el diff
// demuestra (o refuta) la paridad.

import { writeFileSync } from "node:fs";

import {
  getDashboardTendencia,
  getDashboardTopProductos,
} from "../src/lib/dashboard/kpi-logic";

const PERIODS = ["today", "week", "month", "all"] as const;
const CUSTOM_RANGE = { from: "2026-03-01", to: "2026-06-30" };
const BRANCHES = [
  { sucursalId: 1, isAdmin: false },
  { sucursalId: 2, isAdmin: false },
  { sucursalId: 0, isAdmin: true },
];

function outPath(): string {
  const index = process.argv.indexOf("--out");
  if (index === -1 || !process.argv[index + 1]) {
    throw new Error("Falta --out <ruta.json>");
  }
  return process.argv[index + 1];
}

async function main() {
  const result: Record<string, unknown> = {};

  for (const branch of BRANCHES) {
    for (const period of PERIODS) {
      const key = `${branch.sucursalId}:${period}`;
      result[`tendencia:${key}`] = await getDashboardTendencia(
        branch.sucursalId,
        period,
        branch.isAdmin,
      );
      result[`top10:${key}`] = await getDashboardTopProductos(
        branch.sucursalId,
        period,
        branch.isAdmin,
        10,
      );
      result[`top3:${key}`] = await getDashboardTopProductos(
        branch.sucursalId,
        period,
        branch.isAdmin,
        3,
      );
    }

    const customKey = `${branch.sucursalId}:custom`;
    result[`tendencia:${customKey}`] = await getDashboardTendencia(
      branch.sucursalId,
      "custom",
      branch.isAdmin,
      null,
      CUSTOM_RANGE,
    );
    result[`top10:${customKey}`] = await getDashboardTopProductos(
      branch.sucursalId,
      "custom",
      branch.isAdmin,
      10,
      null,
      CUSTOM_RANGE,
    );
  }

  const path = outPath();
  writeFileSync(path, JSON.stringify(result, null, 2), "utf8");
  const keys = Object.keys(result).length;
  console.log(`[kpi-parity] ${keys} escenarios -> ${path}`);
}

main().catch((error) => {
  console.error("[kpi-parity] falló:", error);
  process.exit(1);
});
