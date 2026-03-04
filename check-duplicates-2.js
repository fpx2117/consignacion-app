const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:eAudcMRZEyeCIXiwcErafJUALdfrTgQS@yamabiko.proxy.rlwy.net:55320/railway',
});

async function run() {
    await client.connect();

    // Find categories with duplicate names
    const res = await client.query(
        'SELECT nombre, COUNT(*) as count FROM "Categoria" GROUP BY nombre HAVING COUNT(*) > 1'
    );

    if (res.rows.length === 0) {
        console.log("No duplicates found. The database should be ready for Prisma to run.");
    } else {
        console.log("Duplicates found:");
        console.table(res.rows);

        // Auto-rename duplicates
        for (const row of res.rows) {
            console.log(`Fixing duplicates for: ${row.nombre}`);
            const cats = await client.query(
                'SELECT id FROM "Categoria" WHERE nombre = $1 ORDER BY id ASC',
                [row.nombre]
            );

            // Keep the first one, rename the rest
            for (let i = 1; i < cats.rows.length; i++) {
                const id = cats.rows[i].id;
                const newName = `${row.nombre} (Duplicado ${i})`;
                await client.query(
                    'UPDATE "Categoria" SET nombre = $1 WHERE id = $2',
                    [newName, id]
                );
                console.log(`Renamed id ${id} to ${newName}`);
            }
        }
    }

    await client.end();
}

run().catch(console.error);
