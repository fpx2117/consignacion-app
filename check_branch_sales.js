const { Client } = require('pg');
const connectionString = 'postgresql://postgres:eAudcMRZEyeCIXiwcErafJUALdfrTgQS@yamabiko.proxy.rlwy.net:55320/railway';

async function check() {
    const client = new Client({ connectionString });
    await client.connect();

    console.log('--- ANALIZANDO VENTAS EN SUCURSAL 2 ---');

    // 1. Obtener el cliente Consumidor Final de la Sucursal 1 (el que probablemente se usó por error)
    const resCli1 = await client.query("SELECT id FROM \"Cliente\" WHERE nombre = 'Consumidor Final' AND \"sucursalId\" = 1");
    const cli1Id = resCli1.rows[0]?.id;

    // 2. Obtener el cliente Consumidor Final de la Sucursal 2 (el nuevo)
    const resCli2 = await client.query("SELECT id FROM \"Cliente\" WHERE nombre = 'Consumidor Final' AND \"sucursalId\" = 2");
    const cli2Id = resCli2.rows[0]?.id;

    console.log(`ID Consumidor Final Sucursal 1: ${cli1Id}`);
    console.log(`ID Consumidor Final Sucursal 2: ${cli2Id}`);

    // 3. Ver ventas de sucursal 2
    const resVentas = await client.query(`
        SELECT v.id, v."clienteId", c.nombre as "nombreCliente", c."sucursalId" as "sucursalCliente"
        FROM "Venta" v
        JOIN "Cliente" c ON v."clienteId" = c.id
        WHERE v."sucursalId" = 2
    `);

    console.log(`\nVentas encontradas en Sucursal 2: ${resVentas.rows.length}`);
    resVentas.rows.forEach(v => {
        console.log(`Venta #${v.id} -> Cliente ID: ${v.clienteId} (${v.nombreCliente}), Sucursal del Cliente: ${v.sucursalCliente}`);
    });

    // 4. Identificar ventas mal vinculadas
    const malVinculadas = resVentas.rows.filter(v => v.sucursalCliente !== 2);
    if (malVinculadas.length > 0) {
        console.log(`\n⚠️ SE ENCONTRARON ${malVinculadas.length} VENTAS MAL VINCULADAS.`);
    } else {
        console.log(`\n✅ Todas las ventas de la Sucursal 2 están bien vinculadas.`);
    }

    await client.end();
}

check().catch(console.error);
