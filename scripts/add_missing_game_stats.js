
const { Client } = require('pg');
require('dotenv').config();

async function runMigration() {
    console.log("Connecting to database...");
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected. Adding missing game stats columns...");

        const sql = `
            ALTER TABLE games 
            ADD COLUMN IF NOT EXISTS is_break_and_run boolean DEFAULT false,
            ADD COLUMN IF NOT EXISTS is_rack_and_run boolean DEFAULT false,
            ADD COLUMN IF NOT EXISTS is_early_8 boolean DEFAULT false,
            ADD COLUMN IF NOT EXISTS is_scratch_8 boolean DEFAULT false;
        `;

        await client.query(sql);
        console.log("Game stat columns added successfully.");

        // Force schema cache reload
        await client.query("NOTIFY pgrst, 'reload schema';");
        console.log("Notified PostgREST to reload schema.");

    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        await client.end();
    }
}

runMigration();
