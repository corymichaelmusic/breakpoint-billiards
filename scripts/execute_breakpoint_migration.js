const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: 'mobile/.env' });

async function runMigration() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const sql = fs.readFileSync(path.join(__dirname, '../supabase/add_breakpoint_rating_cols.sql'), 'utf8');
        console.log('Running migration...');
        await client.query(sql);
        console.log('Migration successful.');
        await client.query('NOTIFY pgrst, \'reload schema\'');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

runMigration();
