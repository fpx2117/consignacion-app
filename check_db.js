const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:eAudcMRZEyeCIXiwcErafJUALdfrTgQS@yamabiko.proxy.rlwy.net:55320/railway',
});

async function main() {
    await client.connect();
    try {
        const check = await client.query('SELECT * FROM "Sucursal"');
        console.log("Sucursales:", check.rows);
        if (check.rows.length === 0) {
            console.log("No default Sucursal found, inserting ID=1...");
            await client.query(`INSERT INTO "Sucursal" ("id", "nombre", "esPrincipal", "activa", "createdAt", "updatedAt") VALUES (1, 'Sede Principal', true, true, NOW(), NOW())`);
            console.log("Default sucursal created.");
        }
    } catch (err) {
        console.error("Error query:", err.message);
    } finally {
        await client.end();
    }
}

main();
