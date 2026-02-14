
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const dbUrl = process.env.DATABASE_URL;

async function runMigration() {
    console.log("Applying Fix for Chat Tagging RLS Policy...");
    if (!dbUrl) {
        console.error("DATABASE_URL not found in .env.local");
        process.exit(1);
    }
    const client = new Client({ connectionString: dbUrl });
    // Point to the new SQL file
    const sqlPath = path.join(__dirname, '../supabase/fix_chat_tagging_rls.sql');

    try {
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log(`Reading SQL from ${sqlPath}...`);

        await client.connect();
        console.log("Connected to Database.");

        // Execute the SQL
        await client.query(sql);
        console.log("RLS Fix Applied Successfully!");

        // Reload Schema Cache
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
