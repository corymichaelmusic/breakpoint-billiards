const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function run() {
    console.log('Connecting...');
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    console.log('Running SQL...');
    const sql = fs.readFileSync(path.join(__dirname, '../supabase/add_scored_by_column.sql'), 'utf8');
    await client.query(sql);
    console.log('✅ scored_by column added to games table');
    await client.end();
}
run().catch(e => console.error('❌ Error:', e.message));
