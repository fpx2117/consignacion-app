
const { Client } = require('pg');
const connectionString = 'postgresql://postgres:eAudcMRZEyeCIXiwcErafJUALdfrTgQS@yamabiko.proxy.rlwy.net:55320/railway';

async function run() {
    const client = new Client({ connectionString });
    await client.connect();

    console.log('--- RAW MARCH 2026 RECORDS WITH SUCURSAL ---');
    const start = '2026-03-01T00:00:00.000Z';

    const resP = await client.query('SELECT id, monto, tipo, fecha, sucursal_id FROM "Pago" WHERE fecha >= $1 ORDER BY fecha ASC', [start]);
    console.log(`\nPAGOS (${resP.rowCount}):`);
    resP.rows.forEach(r => {
        console.log(`[P] #${r.id} | Sucursal:${r.sucursal_id} | ${r.fecha.toISOString()} | $${r.monto} | ${r.tipo}`);
    });

    const resV = await client.query('SELECT id, total, tipo, fecha, sucursal_id FROM "Venta" WHERE fecha >= $1 ORDER BY fecha ASC', [start]);
    console.log(`\nVENTAS (${resV.rowCount}):`);
    resV.rows.forEach(r => {
        console.log(`[V] #${r.id} | Sucursal:${r.sucursal_id} | ${r.fecha.toISOString()} | $${r.total} | ${r.tipo}`);
    });

    await client.end();
}

run().catch(console.error);
