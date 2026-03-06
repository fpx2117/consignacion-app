
const { Client } = require('pg');
const connectionString = 'postgresql://postgres:eAudcMRZEyeCIXiwcErafJUALdfrTgQS@yamabiko.proxy.rlwy.net:55320/railway';

async function run() {
    const client = new Client({ connectionString });
    await client.connect();

    console.log('--- FINDING MISMATCHED SUCURSALES ---');
    const start = '2026-03-01T00:00:00.000Z';

    // Buscamos pagos y sus ventas asociadas (si las hay por monto y fecha cercana)
    // O simplemente comparamos los totales por sucursal

    const resP = await client.query('SELECT "sucursalId", SUM(monto) as total FROM "Pago" WHERE fecha >= $1 GROUP BY "sucursalId"', [start]);
    console.log('\nPAGOS POR SUCURSAL:');
    console.table(resP.rows);

    const resV = await client.query('SELECT "sucursalId", SUM(total) as total FROM "Venta" WHERE fecha >= $1 GROUP BY "sucursalId"', [start]);
    console.log('\nVENTAS POR SUCURSAL:');
    console.table(resV.rows);

    // Buscar ventas y pagos con el mismo monto y fecha casi idéntica pero distinta sucursal
    const resMismatches = await client.query(`
        SELECT p.id as pago_id, v.id as venta_id, p.monto, p."sucursalId" as p_suc, v."sucursalId" as v_suc, p.fecha
        FROM "Pago" p
        JOIN "Venta" v ON ABS(EXTRACT(EPOCH FROM (p.fecha - v.fecha))) < 5
        WHERE p.monto = v.total AND p."sucursalId" <> v."sucursalId" AND p.fecha >= $1
    `, [start]);

    console.log('\nINDIVIDUAL MISMATCHES (Same time/amount, different branch):');
    console.table(resMismatches.rows);

    await client.end();
}

run().catch(console.error);
