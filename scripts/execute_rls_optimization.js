const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runPg() {
    console.log('Connecting to database...');
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const sqlPath = path.join(__dirname, '../supabase/optimize_leagues_rls.sql');
        console.log(`Reading SQL from ${sqlPath}...`);
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing SQL Optimization...');
        await client.query(sql);
        console.log('Success! RLS Policies optimized.');
    } catch (err) {
        console.error('PG Error:', err);
    } finally {
        await client.end();
    }
}

runPg();
