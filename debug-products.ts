import { PrismaClient } from "@prisma/client";

async function main() {
    const prisma = new PrismaClient();
    try {
        const products = await prisma.producto.findMany({
            where: {
                nombre: {
                    contains: "ELFBAR",
                    mode: 'insensitive'
                }
            },
            include: {
                categoria: true
            }
        });

        console.log("DEBUG: Found products matching 'ELFBAR':");
        products.forEach(p => {
            console.log(`- Product: ${p.nombre} (ID: ${p.id})`);
            console.log(`  Category ID: ${p.categoriaId}`);
            console.log(`  Category Name: ${p.categoria?.nombre}`);
            console.log(`  Category Discounts: ${JSON.stringify(p.categoria?.descuentos)}`);
        });

        const allCategoriesWithDiscounts = (await prisma.categoria.findMany()).filter(c => c.descuentos);
        console.log("\nDEBUG: All categories with discounts:");
        allCategoriesWithDiscounts.forEach(c => {
            console.log(`- Category: ${c.nombre} (ID: ${c.id})`);
            console.log(`  Discounts: ${JSON.stringify(c.descuentos)}`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
