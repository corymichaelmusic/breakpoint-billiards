const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    await client.connect();
    try {
        const sql = fs.readFileSync('supabase/optimize_match_fetch.sql', 'utf8');
        await client.query(sql);
        console.log('Successfully applied optimize_match_fetch.sql');
    } catch (err) {
        console.error('Error applying migration:', err);
    } finally {
        await client.end();
    }
}

run();
