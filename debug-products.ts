import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

async function main() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL not set");
    const pool = new pg.Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });
    try {
        const products = await prisma.producto.findMany({
            where: {
                nombre: {
                    contains: "ELFBAR",
                    mode: 'insensitive'
                }
            },
            include: {
                categoria: true,
                subcategoria: true
            }
        });

        console.log("DEBUG: Found products matching 'ELFBAR':");
        products.forEach(p => {
            console.log(`- Product: ${p.nombre} (ID: ${p.id})`);
            console.log(`  Category: ${p.categoria?.nombre || 'None'}`);
            console.log(`  Subcategory: ${p.subcategoria?.nombre || 'None'}`);
            console.log(`  Subcategory Discounts: ${JSON.stringify((p.subcategoria as any)?.descuentos)}`);
        });

        const allSubcategories = await prisma.subcategoria.findMany();
        const subcategoriesWithDiscounts = allSubcategories.filter(s => (s as any).descuentos);
        console.log("\nDEBUG: All subcategories with discounts:");
        subcategoriesWithDiscounts.forEach(s => {
            console.log(`- Subcategory: ${s.nombre} (ID: ${s.id})`);
            console.log(`  Discounts: ${JSON.stringify((s as any).descuentos)}`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
