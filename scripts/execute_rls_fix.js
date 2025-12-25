
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const dbUrl = process.env.DATABASE_URL;

async function runMigration() {
    console.log("Starting RLS Fix Migration...");
    if (!dbUrl) {
        console.error("DATABASE_URL not found.");
        process.exit(1);
    }
    const client = new Client({ connectionString: dbUrl });
    const sqlPath = path.join(__dirname, '../supabase/finalize_match_stats.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    try {
        await client.connect();
        await client.query(sql);
        console.log("RLS Policies Updated Successfully!");
    } catch (e) {
        console.error("Migration Error:", e);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();
