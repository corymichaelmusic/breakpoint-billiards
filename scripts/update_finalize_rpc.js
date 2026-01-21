
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    if (!process.env.DATABASE_URL) {
        console.error("Error: DATABASE_URL not found in .env.local");
        process.exit(1);
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected to database.");

        const sqlPath = path.join(__dirname, '../supabase/finalize_match_stats_v2.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log("Executing RPC update...");
        await client.query(sql);
        console.log("RPC update executed successfully.");

    } catch (err) {
        console.error("Error executing RPC update:", err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();
