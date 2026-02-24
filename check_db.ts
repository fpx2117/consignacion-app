import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const migrations = await prisma.$queryRaw`SELECT * FROM _prisma_migrations ORDER BY started_at DESC LIMIT 5`;
    console.log("================ MIGRATIONS ================");
    console.dir(migrations, { depth: null });

    const pg_type = await prisma.$queryRaw`SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'EstadoSuscripcion'`;
    console.log("\n================ ESTADO SUSCRIPCION ================");
    console.dir(pg_type, { depth: null });

    // Also check if Sucursal exists
    try {
        const sucursales = await prisma.$queryRaw`SELECT * FROM "Sucursal" LIMIT 1`;
        console.log("\n================ SUCURSAL TABLE ================");
        console.log("Sucursal exists!");
    } catch (e) {
        console.log("\n================ SUCURSAL TABLE ================");
        console.log("Sucursal table DOES NOT exist!");
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
