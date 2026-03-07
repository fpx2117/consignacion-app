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
        const subcats = await prisma.subcategoria.findMany({
            where: { nombre: { contains: "ELFBAR", mode: 'insensitive' } },
        });
        console.log("Subcategories found:", JSON.stringify(subcats, null, 2));

        for (const s of subcats) {
            console.log(`Tipo de descuentos para ${s.nombre}:`, typeof (s as any).descuentos);
            console.log(`¿Es array?`, Array.isArray((s as any).descuentos));
        }
    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
