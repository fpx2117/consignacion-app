
const { Client } = require('pg');
const connectionString = 'postgresql://postgres:eAudcMRZEyeCIXiwcErafJUALdfrTgQS@yamabiko.proxy.rlwy.net:55320/railway';

async function run() {
    const client = new Client({ connectionString });
    await client.connect();

    console.log('--- RECTIFYING TRANSACTION AS USER REQUESTED ---');

    // 1. Revert Venta #12 to Sucursal 2 (Original state of sale/product)
    await client.query('UPDATE "Venta" SET "sucursalId" = 2 WHERE id = 12');
    console.log('Venta #12 returned to Sucursal 2');

    // 2. Move related Stock Movements back to Sucursal 2
    await client.query(`
        UPDATE "MovimientoStock" 
        SET "sucursalId" = 2 
        WHERE motivo = 'VENTA' 
        AND "createdAt" >= '2026-03-05' 
        AND "sucursalId" = 1 
        AND observaciones LIKE '%Venta%'
    `);
    console.log('Stock movements returned to Sucursal 2');

    // 3. Rectify the discrepancy: Move Payment #11 to Sucursal 2
    // Since the sale and product are in S2, the payment (income) should also be recorded in S2
    // to keep the cash flow consistent with the transaction.
    const resP = await client.query('SELECT id FROM "Pago" WHERE monto = 80000 AND fecha >= \'2026-03-05\' AND "sucursalId" = 1');
    if (resP.rows.length > 0) {
        const paymentId = resP.rows[0].id;
        await client.query('UPDATE "Pago" SET "sucursalId" = 2 WHERE id = $1', [paymentId]);
        console.log(`Payment #${paymentId} moved to Sucursal 2 to match the Sale and Product.`);
    } else {
        console.log('Payment #11 not found in S1, might already be moved or ID differs.');
    }

    await client.end();
}

run().catch(console.error);
