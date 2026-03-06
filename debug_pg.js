
const { Client } = require('pg');

async function check() {
    const client = new Client({
        connectionString: "postgresql://postgres:8231MNGNYHJQ@yamabiko.proxy.rlwy.net:55320/railway"
    });

    await client.connect();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const res = await client.query(`
    SELECT tipo, sucursal_id, SUM(monto) as total
    FROM "Pago"
    WHERE fecha >= $1
    GROUP BY tipo, sucursal_id
  `, [startOfMonth]);

    console.log('--- PAGOS POR TIPO Y SUCURSAL ---');
    res.rows.forEach(r => {
        console.log(`Tipo: ${r.tipo} | Sucursal: ${r.sucursal_id} | Total: ${r.total}`);
    });

    const resV = await client.query(`
    SELECT tipo, sucursal_id, SUM(total) as total
    FROM "Venta"
    WHERE fecha >= $1
    GROUP BY tipo, sucursal_id
  `, [startOfMonth]);

    console.log('\n--- VENTAS POR TIPO Y SUCURSAL ---');
    resV.rows.forEach(r => {
        console.log(`Tipo: ${r.tipo} | Sucursal: ${r.sucursal_id} | Total: ${r.total}`);
    });

    await client.end();
}

check().catch(console.error);
