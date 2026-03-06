
const { Client } = require('pg');
const connectionString = 'postgresql://postgres:eAudcMRZEyeCIXiwcErafJUALdfrTgQS@yamabiko.proxy.rlwy.net:55320/railway';

async function run() {
    const client = new Client({ connectionString });
    await client.connect();

    console.log('--- DETAILED CHECK 80k ---');

    const resP = await client.query('SELECT * FROM "Pago" WHERE id = 11');
    console.log('PAGO 11:', resP.rows[0]);

    const resV = await client.query('SELECT * FROM "Venta" WHERE id = 12');
    console.log('\nVENTA 12:', resV.rows[0]);

    const resC = await client.query('SELECT id, nombre, "sucursalId" FROM "Cliente" WHERE id = $1', [resV.rows[0].clienteId]);
    console.log('\nCLIENTE associated with Venta:', resC.rows[0]);

    await client.end();
}

run().catch(console.error);
