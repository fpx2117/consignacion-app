
const { Client } = require('pg');
const connectionString = 'postgresql://postgres:eAudcMRZEyeCIXiwcErafJUALdfrTgQS@yamabiko.proxy.rlwy.net:55320/railway';

async function run() {
    const client = new Client({ connectionString });
    await client.connect();

    console.log('--- REPAIRING VENTA #12 SUCURSAL ---');

    // 1. Update Venta
    await client.query('UPDATE "Venta" SET "sucursalId" = 1 WHERE id = 12');
    console.log('Venta #12 updated to Sucursal 1');

    // 2. Update VentaDetalle
    await client.query('UPDATE "VentaDetalle" SET "sucursalId" = 1 WHERE "ventaId" = 12').catch(e => console.log('VentaDetalle update skipped or failed (might not have sucursalId column):', e.message));

    // 3. Update related Stock Movements
    // Look for movements on the same day for this sale
    await client.query(`
        UPDATE "MovimientoStock" 
        SET "sucursalId" = 1 
        WHERE motivo = 'VENTA' 
        AND "createdAt" >= '2026-03-05' 
        AND "sucursalId" = 2 
        AND observaciones LIKE '%Venta%'
    `);
    console.log('Related stock movements updated to Sucursal 1');

    await client.end();
}

run().catch(console.error);
