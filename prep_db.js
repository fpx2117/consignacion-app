const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:eAudcMRZEyeCIXiwcErafJUALdfrTgQS@yamabiko.proxy.rlwy.net:55320/railway',
});

async function main() {
    await client.connect();
    try {
        console.log("Creating Sucursal table if not exists...");
        await client.query(`
      CREATE TABLE IF NOT EXISTS "Sucursal" (
          "id" SERIAL PRIMARY KEY,
          "nombre" TEXT NOT NULL,
          "esPrincipal" BOOLEAN NOT NULL DEFAULT false,
          "activa" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

        const check = await client.query('SELECT * FROM "Sucursal" WHERE id = 1');
        if (check.rows.length === 0) {
            console.log("Inserting ID=1...");
            await client.query(`INSERT INTO "Sucursal" ("id", "nombre", "esPrincipal") VALUES (1, 'Sede Principal', true)`);
        } else {
            console.log("ID 1 exists.");
        }

        // Deleting the broken migration from history so Prisma doesn't get confused
        await client.query(`DELETE FROM _prisma_migrations WHERE migration_name LIKE '%init_sucursales%'`);
        console.log("Cleaned _prisma_migrations.");

    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await client.end();
    }
}

main();
