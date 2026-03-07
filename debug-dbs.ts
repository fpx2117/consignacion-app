import { Client } from 'pg';

async function checkDbs() {
    const yamabikoUrl = "postgresql://postgres:eAudcMRZEyeCIXiwcErafJUALdfrTgQS@yamabiko.proxy.rlwy.net:55320/railway";
    const hopperUrl = "postgresql://postgres:JIvBMTOxigSorZXlepZlcetOQnPXKbGH@hopper.proxy.rlwy.net:54604/railway";

    async function check(url: string, label: string) {
        console.log(`\n--- ${label} ---`);
        const client = new Client({ connectionString: url });
        try {
            await client.connect();

            // Products count
            const prodCount = await client.query('SELECT count(*) FROM "Producto"');
            console.log(`Producto count: ${prodCount.rows[0].count}`);

            // Categories
            const catCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'Categoria'");
            const cols = catCols.rows.map(r => r.column_name);
            console.log(`Categoria columns: ${cols.join(', ')}`);

            if (cols.includes('descuentos')) {
                const catData = await client.query('SELECT id, nombre, descuentos FROM "Categoria" WHERE descuentos IS NOT NULL');
                console.log(`Categoria rows with discounts: ${catData.rowCount}`);
                catData.rows.forEach(r => console.log(`  ID: ${r.id}, Name: ${r.nombre}, Discounts: ${JSON.stringify(r.descuentos)}`));
            }

            // Subcategories
            const subCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'Subcategoria'");
            const sCols = subCols.rows.map(r => r.column_name);
            console.log(`Subcategoria columns: ${sCols.join(', ')}`);

            if (sCols.includes('descuentos')) {
                const subData = await client.query('SELECT count(*) FROM "Subcategoria" WHERE descuentos IS NOT NULL');
                console.log(`Subcategoria rows with discounts: ${subData.rows[0].count}`);
            }

        } catch (e) {
            console.error(`Error in ${label}:`, e);
        } finally {
            await client.end();
        }
    }

    await check(yamabikoUrl, "YAMABIKO (Source?)");
    await check(hopperUrl, "HOPPER (Target?)");
}

checkDbs();
