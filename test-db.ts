import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const sucursales = await prisma.$queryRaw`SELECT id FROM "Sucursal"`;
    console.log("Sucursales:", sucursales);

    const brandings = await prisma.$queryRaw`SELECT id FROM "Branding"`;
    console.log("Brandings:", brandings);
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
