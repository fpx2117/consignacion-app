import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error("❌ DATABASE_URL is not defined in .env");
    process.exit(1);
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("--- DEBUG ENV & PRISMA ---");
    console.log("CWD:", process.cwd());
    console.log("DATABASE_URL FOUND:", !!process.env.DATABASE_URL);

    try {
        await prisma.$connect();
        console.log("✅ Connected successfully!");
        const userCount = await prisma.usuario.count();
        console.log("✅ User count:", userCount);
    } catch (err) {
        console.error("❌ Prisma Error:", err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
