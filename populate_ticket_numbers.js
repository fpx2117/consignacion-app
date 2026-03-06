const { Client } = require('pg');
const connectionString = 'postgresql://postgres:eAudcMRZEyeCIXiwcErafJUALdfrTgQS@yamabiko.proxy.rlwy.net:55320/railway';

async function populate() {
    const client = new Client({ connectionString });
    await client.connect();

    console.log('--- POBLANDO NÚMEROS DE TICKET ---');

    // 1. Obtener sucursales
    const resSuc = await client.query('SELECT id, nombre FROM "Sucursal"');

    for (const sucursal of resSuc.rows) {
        console.log(`\nProcesando Sucursal ${sucursal.id}: ${sucursal.nombre}...`);

        // 2. Obtener ventas de esta sucursal ordenadas por ID (ascendente)
        const resVentas = await client.query(`
            SELECT id FROM "Venta" 
            WHERE "sucursalId" = $1
            ORDER BY id ASC
        `, [sucursal.id]);

        console.log(`  > Encontradas ${resVentas.rows.length} ventas.`);

        let currentNumber = 1;
        for (const venta of resVentas.rows) {
            await client.query(`
                UPDATE "Venta"
                SET "numeroVenta" = $1
                WHERE id = $2
            `, [currentNumber, venta.id]);
            currentNumber++;
        }
        console.log(`  > Numeración completada hasta el #${currentNumber - 1}`);
    }

    console.log('\n--- POBLACIÓN FINALIZADA ---');
    await client.end();
}

populate().catch(console.error);
