const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
    try {
        await client.connect();
        console.log("Connected. Running migration...");

        const sql = `ALTER TABLE leagues ADD COLUMN IF NOT EXISTS schedule_day TEXT;`;
        await client.query(sql);

        console.log('Migration applied successfully via PG');
    } catch (pgError) {
        console.error('PG Error:', pgError);
    } finally {
        await client.end();
    }
}

runMigration();
