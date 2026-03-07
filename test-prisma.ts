import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

async function testPrisma() {
    const prisma = new PrismaClient();
    try {
        console.log('Testing Prisma connection to Hopper...');
        console.log('DATABASE_URL starts with:', process.env.DATABASE_URL?.substring(0, 20));
        const productos = await prisma.producto.findMany({
            take: 1,
            include: {
                categoria: true,
                subcategoria: true
            }
        });
        console.log('Successfully fetched products:', productos.length);
        if (productos.length > 0) {
            console.log('Product 0 Category:', productos[0].categoria?.nombre);
            console.log('Product 0 Subcategory Discounts:', productos[0].subcategoria?.descuentos);
        }
    } catch (e: any) {
        console.error('Prisma Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

testPrisma();
