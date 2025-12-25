const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runPg() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const sqlPath = path.join(__dirname, '../supabase/update_schema_payments.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await client.query(sql);
        console.log('Schema updated successfully via PG client.');
    } catch (err) {
        console.error('PG Error:', err);
        console.log('Please run the contents of supabase/update_schema_payments.sql in your Supabase SQL Editor.');
    } finally {
        await client.end();
    }
}

runPg();
