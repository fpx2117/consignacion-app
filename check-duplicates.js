const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:eAudcMRZEyeCIXiwcErafJUALdfrTgQS@yamabiko.proxy.rlwy.net:55320/railway',
});

async function run() {
    await client.connect();

    const res = await client.query(
        'SELECT nombre, "sucursalId", COUNT(*) as count FROM "Categoria" GROUP BY nombre, "sucursalId" HAVING COUNT(*) > 1'
    );

    if (res.rows.length === 0) {
        console.log("No duplicates found.");
    } else {
        console.log("Duplicates found:");
        console.table(res.rows);

        // Auto-rename duplicates to allow the constraint to be created
        for (const row of res.rows) {
            console.log(`Fixing duplicates for: ${row.nombre} in sucursal ${row.sucursalId}`);
            const cats = await client.query(
                'SELECT id FROM "Categoria" WHERE nombre = $1 AND "sucursalId" = $2 ORDER BY id ASC',
                [row.nombre, row.sucursalId]
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

    // Also check if sucursalId column exists on Producto
    try {
        const colCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='Producto' and column_name='sucursalId'
    `);
        console.log("Producto.sucursalId exists:", colCheck.rows.length > 0);
    } catch (e) { console.error(e) }

    await client.end();
}

run().catch(console.error);
