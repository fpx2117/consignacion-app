import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const cats = await prisma.categoria.findMany({
        where: { nombre: { contains: "ELFBAR" } },
    });
    console.log(JSON.stringify(cats, null, 2));

    for (const c of cats) {
        console.log(`Tipo de descuentos para ${c.nombre}:`, typeof c.descuentos);
        console.log(`¿Es array?`, Array.isArray(c.descuentos));
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
