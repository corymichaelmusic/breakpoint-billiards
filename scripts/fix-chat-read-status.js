const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runFix() {
    console.log('Connecting to database...');
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const sqlPath = path.join(__dirname, '../supabase/fix_chat_policy_clerk.sql');
        console.log(`Reading SQL from ${sqlPath}...`);
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing SQL...');
        await client.query(sql);
        console.log('chat_read_status table fixed successfully.');
    } catch (err) {
        console.error('PG Error:', err);
    } finally {
        await client.end();
    }
}

runFix();
