const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkClients() {
    try {
        const clients = await prisma.cliente.findMany({
            where: {
                nombre: {
                    contains: 'Consumidor Final',
                    mode: 'insensitive'
                }
            },
            select: {
                id: true,
                nombre: true,
                sucursalId: true
            }
        });

        const sucursales = await prisma.sucursal.findMany({
            select: { id: true, nombre: true }
        });

        console.log('--- Clientes "Consumidor Final" encontrados ---');
        console.log(JSON.stringify(clients, null, 2));

        console.log('\n--- Sucursales ---');
        console.log(JSON.stringify(sucursales, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

checkClients();
