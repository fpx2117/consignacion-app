const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:eAudcMRZEyeCIXiwcErafJUALdfrTgQS@yamabiko.proxy.rlwy.net:55320/railway',
});

async function run() {
    await client.connect();

    try {
        const tableCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='Categoria'
    `);
        console.log("Categoria columns:", tableCheck.rows.map(r => r.column_name).join(', '));
    } catch (e) { console.error(e) }

    try {
        const tableCheck2 = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='Producto'
    `);
        console.log("Producto columns:", tableCheck2.rows.map(r => r.column_name).join(', '));
    } catch (e) { console.error(e) }

    await client.end();
}

run().catch(console.error);
