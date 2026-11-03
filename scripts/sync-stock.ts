// scripts/sync-stock.ts
// RETIRADO. Recalculaba Producto = SUM(StockSucursal) producto por producto, sin
// transacción, sin lock y sin leer la autoridad de stock: podía pisar un delta
// en vuelo (o competir con el trigger de proyección en DB_PROJECTION).
//
// La reparación global válida es la compensación T14, que bloquea la capacidad
// y las tablas de stock, reconcilia y verifica deriva 0 antes de commitear.
//
// Este archivo queda como guarda: no abre conexión y sale con código 2.

const COMPENSATION_SCRIPT =
  "scripts/migrations/compensate-t14-stock-authority.mjs";

console.error(
  [
    "[RETIRADO] scripts/sync-stock.ts ya no repara stock.",
    "",
    "Escribía Producto = SUM(StockSucursal) sin lock ni autoridad de stock.",
    "La reparación válida es la compensación T14:",
    "",
    `  node ${COMPENSATION_SCRIPT}`,
    "",
    "Requiere:",
    "  DATABASE_URL=<url>",
    "  T14_CONFIRM_DATABASE=<nombre exacto de la base>",
    "  T14_ALLOW_PRODUCTION=true   # solo si el destino es producción",
    "",
    "La compensación bloquea StockAutoridad, StockSucursal y Producto,",
    "reconcilia y falla si queda deriva.",
    "",
    "OJO: fuerza APP_DUAL_WRITE y retira el trigger de proyección.",
    "No la ejecutes con T16 activo (DB_PROJECTION).",
  ].join("\n"),
);

process.exit(2);
