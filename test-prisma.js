const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const prods = await prisma.producto.findMany({
            where: { sucursalId: 1 },
            take: 1
        });
        console.log("Success fetching Producto sucursalId:", prods.length);
    } catch (e) {
        console.error("Error fetching Producto:", e);
    }

    try {
        const cats = await prisma.categoria.findMany({
            where: { sucursalId: 1 },
            take: 1
        });
        console.log("Success fetching Categoria sucursalId:", cats.length);
    } catch (e) {
        console.error("Error fetching Categoria:", e);
    }
}

main().then(() => prisma.$disconnect()).catch(() => prisma.$disconnect());
