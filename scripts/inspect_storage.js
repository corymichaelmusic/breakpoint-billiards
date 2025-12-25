const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function inspectStorage() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // Check Columns
        console.log("--- COLUMNS ---");
        const resCols = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'storage' AND table_name = 'objects';
        `);
        console.table(resCols.rows);

        // Check Triggers
        console.log("--- TRIGGERS ---");
        const resTrig = await client.query(`
            SELECT trigger_name, event_manipulation, event_object_table, action_statement
            FROM information_schema.triggers
            WHERE event_object_schema = 'storage' AND event_object_table = 'objects';
        `);
        console.table(resTrig.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

inspectStorage();
