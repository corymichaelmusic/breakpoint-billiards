
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function runMigration() {
    const sqlPath = path.join(__dirname, '../supabase/feature_session_bounty_config.sql');
    if (!fs.existsSync(sqlPath)) {
        console.error("SQL file not found:", sqlPath);
        process.exit(1);
    }
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log("Reading SQL from:", sqlPath);

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("DATABASE_URL not found in .env.local");
        process.exit(1);
    }

    const client = new Client({ connectionString: dbUrl });
    try {
        await client.connect();
        console.log("Connected to Database. Executing SQL...");
        await client.query(sql);
        console.log("Migration Successfully Applied: Session Bounty Columns Added & Backfilled.");
    } catch (e) {
        console.error("Migration Failed:", e);
    } finally {
        await client.end();
    }
}

runMigration();
