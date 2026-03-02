import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const sucursales = await prisma.sucursal.findMany({
        include: {
            branding: true,
            configuracion: true
        }
    });
    console.log(JSON.stringify(sucursales, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
