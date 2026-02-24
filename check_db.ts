import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const tables = ['Configuracion', 'Branding', 'Producto'];
    for (const table of tables) {
        console.log(`\nColumns for ${table}:`);
        const columns = await prisma.$queryRawUnsafe(
            `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${table}'`
        );
        console.table(columns);
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
