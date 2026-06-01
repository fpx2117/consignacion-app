// scripts/check-product.ts - Buscar producto específico
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const nombre = process.argv[2] || "odyssey";
  
  console.log(`Buscando: ${nombre}`);
  
  const productos = await prisma.producto.findMany({
    where: { 
      nombre: { contains: nombre, mode: 'insensitive' }
    },
    select: {
      id: true,
      nombre: true,
      stockDisponibleUnits: true,
      stockConsignadoUnits: true,
      stockSucursals: {
        select: {
          sucursalId: true,
          stockDisponibleUnits: true,
          stockConsignadoUnits: true
        }
      }
    }
  });

  console.log(`Encontrados: ${productos.length}`);
  
  for (const p of productos) {
    console.log('\n=== Producto ===');
    console.log('ID:', p.id);
    console.log('Nombre:', p.nombre);
    console.log('Producto.stockDisponibleUnits:', p.stockDisponibleUnits);
    console.log('Producto.stockConsignadoUnits:', p.stockConsignadoUnits);
    
    const sumaDisp = p.stockSucursals.reduce((acc, s) => acc + (s.stockDisponibleUnits ?? 0), 0);
    const sumaCons = p.stockSucursals.reduce((acc, s) => acc + (s.stockConsignadoUnits ?? 0), 0);
    
    console.log('Suma stockSucursal disponible:', sumaDisp);
    console.log('Suma stockSucursal consignado:', sumaCons);
    
    if (p.stockDisponibleUnits !== sumaDisp || p.stockConsignadoUnits !== sumaCons) {
      console.log('⚠️ INCONSISTENCIA DETECTADA!');
    }
    
    console.log('\nDetalle por sucursal:');
    p.stockSucursals.forEach(s => console.log('  Sucursal', s.sucursalId, '- Disponible:', s.stockDisponibleUnits, '- Consignado:', s.stockConsignadoUnits));
  }
}

main().finally(() => prisma.$disconnect());