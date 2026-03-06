const { Client } = require('pg');
const connectionString = 'postgresql://postgres:eAudcMRZEyeCIXiwcErafJUALdfrTgQS@yamabiko.proxy.rlwy.net:55320/railway';

async function checkClients() {
    const client = new Client({ connectionString });
    await client.connect();

    console.log('--- BUSCANDO CONSUMIDOR FINAL POR SUCURSAL ---');

    const resSuc = await client.query('SELECT id, nombre FROM "Sucursal" ORDER BY id');
    console.log('\nSucursales registradas:');
    console.log(resSuc.rows);

    const resCli = await client.query(`
        SELECT id, nombre, "sucursalId" 
        FROM "Cliente" 
        WHERE nombre ILIKE '%Consumidor Final%'
        ORDER BY "sucursalId"
    `);
    console.log('\nClientes "Consumidor Final" encontrados:');
    console.log(resCli.rows);

    const missing = resSuc.rows.filter(s => !resCli.rows.find(c => c.sucursalId === s.id));
    if (missing.length > 0) {
        console.log('\nSucursales que faltan tener "Consumidor Final":');
        console.log(missing.map(m => `Sucursal ${m.id}: ${m.nombre}`));
    } else {
        console.log('\nTodas las sucursales tienen "Consumidor Final".');
    }

    await client.end();
}

checkClients().catch(console.error);
