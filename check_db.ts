import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    log: ['error', 'info', 'query', 'warn']
});

async function main() {
    try {
        const sucursales = await prisma.sucursal.findMany();
        console.log("Sucursales registradas:", sucursales);

        if (sucursales.length === 0) {
            console.log("No hay sede principal. Insertando...");
            await prisma.sucursal.create({
                data: {
                    id: 1,
                    nombre: 'Sede Principal',
                    esPrincipal: true
                }
            });
            console.log("Sede principal creada.");
        }
    } catch (e: any) {
        console.error("Error al acceder a la BD:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
