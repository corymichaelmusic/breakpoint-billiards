
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const dbUrl = process.env.DATABASE_URL;

async function runMigration() {
    console.log("Adding verification columns...");
    if (!dbUrl) {
        console.error("DATABASE_URL not found.");
        process.exit(1);
    }
    const client = new Client({ connectionString: dbUrl });
    const sqlPath = path.join(__dirname, '../supabase/add_verification_columns.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    try {
        await client.connect();
        await client.query(sql);
        console.log("Verification Columns Added!");

        // Reload Schema Cache (Often needed for PostgREST)
        await client.query("NOTIFY pgrst, 'reload schema';");
        console.log("Notified PostgREST to reload schema.");

    } catch (e) {
        console.error("Migration Error:", e);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();
