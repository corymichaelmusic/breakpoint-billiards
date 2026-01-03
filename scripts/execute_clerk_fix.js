
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runMigration() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();

        const sqlPath = path.join(__dirname, '../supabase/fix_clerk_ids.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing migration...');
        await client.query(sql);
        console.log('Migration completed successfully.');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

runMigration();
