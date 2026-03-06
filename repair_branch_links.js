const { Client } = require('pg');
const connectionString = 'postgresql://postgres:eAudcMRZEyeCIXiwcErafJUALdfrTgQS@yamabiko.proxy.rlwy.net:55320/railway';

async function repair() {
    const client = new Client({ connectionString });
    await client.connect();

    console.log('--- REPARANDO VINCULACIÓN EN SUCURSAL 2 ---');

    // 1. IDs de clientes
    const cli1Id = 1; // Consumidor Final Suc 1
    const cli2Id = 3; // Consumidor Final Suc 2

    // 2. Actualizar Ventas de Sucursal 2 que apunten al Cliente 1
    const resVentas = await client.query(`
        UPDATE "Venta"
        SET "clienteId" = $1
        WHERE "sucursalId" = 2 AND "clienteId" = $2
        RETURNING id
    `, [cli2Id, cli1Id]);

    console.log(`Ventas actualizadas: ${resVentas.rows.length}`);
    resVentas.rows.forEach(v => console.log(`  > Venta #${v.id} re-vinculada a Cliente ${cli2Id}`));

    // 3. Actualizar Pagos de Sucursal 2 que apunten al Cliente 1
    const resPagos = await client.query(`
        UPDATE "Pago"
        SET "clienteId" = $1
        WHERE "sucursalId" = 2 AND "clienteId" = $2
        RETURNING id
    `, [cli2Id, cli1Id]);

    console.log(`Pagos actualizados: ${resPagos.rows.length}`);
    resPagos.rows.forEach(p => console.log(`  > Pago #${p.id} re-vinculado a Cliente ${cli2Id}`));

    console.log('\n--- REPARACIÓN FINALIZADA ---');
    await client.end();
}

repair().catch(console.error);
