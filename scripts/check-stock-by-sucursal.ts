// scripts/check-stock-by-sucursal.ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const productoNombre = process.argv[2] || "go mango";
  
  console.log(`Buscando productos que contengan: ${productoNombre}\n`);
  
  // Buscar producto
  const productos = await prisma.producto.findMany({
    where: { nombre: { contains: productoNombre, mode: 'insensitive' } },
    select: { id: true, nombre: true }
  });
  
  for (const prod of productos) {
    console.log(`=== ${prod.nombre} (ID: ${prod.id}) ===`);
    
    // Ver stockSucursal por cada sucursal
    const stocks = await prisma.stockSucursal.findMany({
      where: { productoId: prod.id },
      include: { sucursal: { select: { id: true, nombre: true }}}
    });
    
    if (stocks.length === 0) {
      console.log('  ⚠️ NO tiene stock en ninguna sucursal!');
    } else {
      for (const s of stocks) {
        console.log(`  Sucursal ${s.sucursal.nombre} (ID ${s.sucursal.id}): disponible=${s.stockDisponibleUnits}, consignado=${s.stockConsignadoUnits}`);
      }
    }
    console.log('');
  }
  
  // Listar todas las sucursales disponibles
  const sucursales = await prisma.sucursal.findMany({ select: { id: true, nombre: true }});
  console.log('=== Sucursales en el sistema ===');
  sucursales.forEach(s => console.log(`  ID ${s.id}: ${s.nombre}`));
}

main().finally(() => prisma.$disconnect());