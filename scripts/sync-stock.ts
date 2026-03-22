// scripts/sync-stock.ts
// Ejecutar: npx tsx scripts/sync-stock.ts
// Sincroniza Producto.stockDisponibleUnits y stockConsignadoUnits
// con la suma real de StockSucursal (repara desync por bug previo).

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL no definido en .env");

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🔍 Leyendo productos y sus stocks por sucursal...");

  const productos = await prisma.producto.findMany({
    select: {
      id: true,
      nombre: true,
      stockDisponibleUnits: true,
      stockConsignadoUnits: true,
      stockSucursals: {
        select: {
          stockDisponibleUnits: true,
          stockConsignadoUnits: true,
        },
      },
    },
  });

  console.log(`📦 Total productos: ${productos.length}`);

  let actualizados = 0;
  let sinCambios = 0;

  for (const producto of productos) {
    const disponibleReal = producto.stockSucursals.reduce(
      (acc, s) => acc + (s.stockDisponibleUnits ?? 0),
      0
    );
    const consignadoReal = producto.stockSucursals.reduce(
      (acc, s) => acc + (s.stockConsignadoUnits ?? 0),
      0
    );

    const disponibleActual = producto.stockDisponibleUnits ?? 0;
    const consignadoActual = producto.stockConsignadoUnits ?? 0;

    if (disponibleActual !== disponibleReal || consignadoActual !== consignadoReal) {
      await prisma.producto.update({
        where: { id: producto.id },
        data: {
          stockDisponibleUnits: disponibleReal,
          stockConsignadoUnits: consignadoReal,
        },
      });
      console.log(
        `  ✅ [ID ${producto.id}] ${producto.nombre}: disponible ${disponibleActual} → ${disponibleReal} | consignado ${consignadoActual} → ${consignadoReal}`
      );
      actualizados++;
    } else {
      sinCambios++;
    }
  }

  console.log("\n✅ Sincronización completa:");
  console.log(`   Corregidos : ${actualizados}`);
  console.log(`   Sin cambios: ${sinCambios}`);
  console.log(`   Total      : ${productos.length}`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
