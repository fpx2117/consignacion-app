const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:eAudcMRZEyeCIXiwcErafJUALdfrTgQS@yamabiko.proxy.rlwy.net:55320/railway',
});

async function main() {
    await client.connect();
    try {
        const tablesToClean = [
            'Caja', 'Cliente', 'Consignacion', 'MovimientoStock', 'Usuario', 'Venta'
        ];
        for (const table of tablesToClean) {
            try {
                console.log(`Checking table ${table}...`);
                await client.query(`ALTER TABLE "${table}" DROP COLUMN "sucursalId"`);
                console.log(`Dropped sucursalId from ${table}`);
            } catch (err) {
                console.error(`Error or already clean for ${table}:`, err.message);
            }
        }
    } catch (err) {
        console.error("General error:", err.message);
    } finally {
        await client.end();
    }
}

main();
