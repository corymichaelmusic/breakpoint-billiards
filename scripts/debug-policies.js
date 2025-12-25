const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function runPg() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        console.log("--- RLS POLICIES for leagues ---");
        const res = await client.query("select * from pg_policies where tablename = 'leagues'");
        console.table(res.rows);

    } catch (err) {
        console.error('PG Error:', err);
    } finally {
        await client.end();
    }
}

runPg();
