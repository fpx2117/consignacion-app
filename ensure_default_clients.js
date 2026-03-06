const { Client } = require('pg');
const connectionString = 'postgresql://postgres:eAudcMRZEyeCIXiwcErafJUALdfrTgQS@yamabiko.proxy.rlwy.net:55320/railway';

async function repair() {
    const client = new Client({ connectionString });
    await client.connect();

    console.log('--- REPARANDO CLIENTES PREDETERMINADOS ---');

    // 1. Obtener sucursales
    const resSuc = await client.query('SELECT id, nombre FROM "Sucursal"');

    for (const sucursal of resSuc.rows) {
        console.log(`\nVerificando Sucursal ${sucursal.id}: ${sucursal.nombre}...`);

        // Check if exists
        const resCli = await client.query(`
            SELECT id FROM "Cliente" 
            WHERE nombre = 'Consumidor Final' AND "sucursalId" = $1
        `, [sucursal.id]);

        if (resCli.rows.length === 0) {
            console.log(`  > Faltante. Creando...`);
            await client.query(`
                INSERT INTO "Cliente" (nombre, direccion, activo, "sucursalId", "createdAt")
                VALUES ('Consumidor Final', 'Venta Mostrador', true, $1, NOW())
            `, [sucursal.id]);
            console.log(`  > Creado con éxito.`);
        } else {
            console.log(`  > Ya existe (ID: ${resCli.rows[0].id})`);
        }
    }

    console.log('\n--- REPARACIÓN FINALIZADA ---');
    await client.end();
}

repair().catch(console.error);
