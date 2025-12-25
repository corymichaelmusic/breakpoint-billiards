const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();
        const sqlPath = path.join(__dirname, '../supabase/update_schema_innings.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log("Running migration...");
        await client.query(sql);
        console.log("Migration complete.");
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
