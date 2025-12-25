const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const res = await client.query("SELECT id, name, start_date, status FROM leagues WHERE name ILIKE '%Spring 2026%'");
        console.log("Found sessions:", res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
