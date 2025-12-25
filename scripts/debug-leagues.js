const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function runPg() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        console.log("--- ALL LEAGUES ---");
        const res = await client.query('SELECT id, name, type, status, operator_id, parent_league_id FROM leagues');
        console.table(res.rows);

    } catch (err) {
        console.error('PG Error:', err);
    } finally {
        await client.end();
    }
}

runPg();
