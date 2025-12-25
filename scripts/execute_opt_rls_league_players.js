
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const dbUrl = process.env.DATABASE_URL;

async function runMigration() {
    console.log("Applying Optimized League Players RLS Policies...");
    if (!dbUrl) {
        console.error("DATABASE_URL not found in .env.local");
        process.exit(1);
    }
    const client = new Client({ connectionString: dbUrl });
    const sqlPath = path.join(__dirname, '../supabase/opt_rls_league_players.sql');

    try {
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log(`Reading SQL from ${sqlPath}...`);

        await client.connect();
        console.log("Connected to Database.");

        await client.query(sql);
        console.log("League Players RLS Policies Updated Successfully!");

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
