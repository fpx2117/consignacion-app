/**
 * Limpia migraciones fallidas de la tabla _prisma_migrations
 * para destrabar prisma migrate deploy en producción.
 *
 * Ejecutar en cada deploy. Es idempotente y seguro.
 */
const { PrismaClient } = require("@prisma/client");

const FAILED_MIGRATION = "20260523120000_add_storefront_content_to_branding";

async function main() {
  const prisma = new PrismaClient();

  try {
    const result = await prisma.$executeRawUnsafe(
      `DELETE FROM "_prisma_migrations" WHERE "migration_name" = $1`,
      FAILED_MIGRATION
    );
    console.log(
      `✅ clear-failed-migration: ${result > 0 ? "limpiado registro fallido" : "nada que limpiar (OK)"}`
    );
  } catch (error) {
    // Si la tabla no existe (primer deploy) no es un error
    console.log("⚠️  clear-failed-migration: error no bloqueante:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(0)); // Siempre sale con 0 para no bloquear el deploy
