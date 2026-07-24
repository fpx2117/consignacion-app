// scripts/check-stock-issues.ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL no definido");

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // 1. Productos con stock en Producto pero SIN StockSucursal
  console.log("=== Productos con stock en Producto pero SIN StockSucursal ===");

  const productosSinStockSucursal = await prisma.producto.findMany({
    where: {
      stockDisponibleUnits: { gt: 0 },
    },
    select: {
      id: true,
      nombre: true,
      stockDisponibleUnits: true,
      stockConsignadoUnits: true,
    },
  });

  // Filtrar manualmente los que NO tienen stockSucursal
  const sinSucursal = [];
  for (const p of productosSinStockSucursal) {
    const tieneSucursal = await prisma.stockSucursal.findFirst({
      where: { productoId: p.id },
    });
    if (!tieneSucursal) {
      sinSucursal.push(p);
    }
  }

  console.log(`Total: ${sinSucursal.length}`);
  sinSucursal.forEach((p) => {
    console.log(`  ID ${p.id}: ${p.nombre} - stock: ${p.stockDisponibleUnits}`);
  });

  // 2. Productos con inconsistencia entre Producto y StockSucursal
  console.log(
    "\n=== Productos con inconsistencia (Producto vs StockSucursal) ===",
  );

  const todosProductos = await prisma.producto.findMany({
    select: {
      id: true,
      nombre: true,
      stockDisponibleUnits: true,
      stockConsignadoUnits: true,
      stockSucursals: {
        select: {
          sucursalId: true,
          stockDisponibleUnits: true,
          stockConsignadoUnits: true,
        },
      },
    },
  });

  let inconsistentes = 0;
  for (const p of todosProductos) {
    const sumaDisponible = p.stockSucursals.reduce(
      (acc, s) => acc + (s.stockDisponibleUnits ?? 0),
      0,
    );
    const sumaConsignado = p.stockSucursals.reduce(
      (acc, s) => acc + (s.stockConsignadoUnits ?? 0),
      0,
    );

    if (
      p.stockDisponibleUnits !== sumaDisponible ||
      p.stockConsignadoUnits !== sumaConsignado
    ) {
      inconsistentes++;
      console.log(`  ID ${p.id}: ${p.nombre}`);
      console.log(
        `    Producto: disponible=${p.stockDisponibleUnits}, consignado=${p.stockConsignadoUnits}`,
      );
      console.log(
        `    Suma Sucursales: disponible=${sumaDisponible}, consignado=${sumaConsignado}`,
      );
    }
  }

  console.log(`\nTotal con inconsistencia: ${inconsistentes}`);
}

main()
  .catch((e) => console.error("Error:", e))
  .finally(() => prisma.$disconnect());
