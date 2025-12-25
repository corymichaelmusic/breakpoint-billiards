
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// 1. Load Environment Variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.DATABASE_URL;

async function runMigration() {
    const sqlPath = path.join(__dirname, '../supabase/add_realtime_game_columns.sql');
    if (!fs.existsSync(sqlPath)) {
        console.error("SQL file not found:", sqlPath);
        process.exit(1);
    }
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log("Executing SQL Migration: add_realtime_game_columns.sql");

    // Try PG Connection (Preferred for DDL)
    if (dbUrl) {
        console.log("Connecting via Postgres Client...");
        const client = new Client({ connectionString: dbUrl });
        try {
            await client.connect();
            await client.query(sql);
            console.log("Migration Success via PG!");
        } catch (e) {
            console.error("PG Migration Error:", e);
            process.exit(1);
        } finally {
            await client.end();
        }
    } else {
        console.error("DATABASE_URL not found in .env.local");
        process.exit(1);
    }
}

runMigration();
