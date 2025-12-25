
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
        console.log("Connected. Adding BBRS columns...");

        const sql = `
            ALTER TABLE games 
            ADD COLUMN IF NOT EXISTS bbrs_expected_win_prob float8,
            ADD COLUMN IF NOT EXISTS bbrs_player1_rating_start float8,
            ADD COLUMN IF NOT EXISTS bbrs_player2_rating_start float8,
            ADD COLUMN IF NOT EXISTS bbrs_delta_base float8,
            ADD COLUMN IF NOT EXISTS bbrs_delta_scaled float8,
            ADD COLUMN IF NOT EXISTS bbrs_delta_final float8;
        `;

        await client.query(sql);
        console.log("BBRS columns added successfully.");

        // Force schema cache reload (Supabase specific trick: notify pgrst)
        await client.query("NOTIFY pgrst, 'reload schema';");
        console.log("Notified PostgREST to reload schema.");

    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        await client.end();
    }
}

runMigration();
