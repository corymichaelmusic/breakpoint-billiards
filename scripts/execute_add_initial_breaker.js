
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../mobile/.env') });

const { Client } = require('pg');
const fs = require('fs');

async function executeMigration() {
    console.log('Adding initial_breaker_id column...');
    const sql = fs.readFileSync(path.join(__dirname, '../supabase/add_initial_breaker.sql'), 'utf8');

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        await client.query(sql);
        console.log('Migration executed successfully.');
        await client.query("NOTIFY pgrst, 'reload schema';");
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

executeMigration();
