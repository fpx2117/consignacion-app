const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const migrations = await prisma.$queryRaw`SELECT * FROM _prisma_migrations ORDER BY started_at DESC LIMIT 5`;
    console.log("Migrations:");
    console.table(migrations);

    const pg_type = await prisma.$queryRaw`SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'EstadoSuscripcion'`;
    console.log("\nEstadoSuscripcion:");
    console.table(pg_type);
}

main().catch(console.error).finally(() => prisma.$disconnect());
