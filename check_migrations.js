const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:eAudcMRZEyeCIXiwcErafJUALdfrTgQS@yamabiko.proxy.rlwy.net:55320/railway',
});

async function main() {
    await client.connect();
    try {
        const check = await client.query('SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5');
        console.log("Last 5 migrations in DB:");
        check.rows.forEach(r => console.log(r.migration_name));
    } catch (err) {
        console.error("Error query:", err.message);
    } finally {
        await client.end();
    }
}

main();
