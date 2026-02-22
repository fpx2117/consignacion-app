import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Testing connection...");
    console.log("DATABASE_URL present:", !!process.env.DATABASE_URL);
    try {
        await prisma.$connect();
        console.log("Connected successfully!");
        const count = await prisma.usuario.count();
        console.log("User count:", count);
    } catch (error) {
        console.error("Connection failed:");
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
