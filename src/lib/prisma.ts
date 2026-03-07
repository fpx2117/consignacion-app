import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
// Reload triggered by Antigravity to refresh generated client (v2)

/**
 * 1. Setup the Connection String
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined in your .env file");
}

/**
 * 2. Define the Global Type 
 * This prevents multiple instances of Prisma Client in development.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * 3. Create the Client Factory
 * We use 'pg.Pool' which is the standard way to provide a connection to PrismaPg.
 */
const createPrismaClient = () => {
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
};

/**
 * 4. Export the Singleton
 * In dev, we recreate the client to avoid stale generated code cache
 */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

/**
 * 5. Store in Global (Only in Prod or if we want to stick to one instance)
 */
if (process.env.NODE_ENV !== "development") {
  globalForPrisma.prisma = prisma;
}