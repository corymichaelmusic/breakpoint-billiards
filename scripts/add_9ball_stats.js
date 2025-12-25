
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
        console.log("Connected. Adding 9-ball specific columns...");

        const sql = `
            ALTER TABLE games 
            ADD COLUMN IF NOT EXISTS is_9_on_snap boolean DEFAULT false,
            ADD COLUMN IF NOT EXISTS is_win_zip boolean DEFAULT false;
        `;

        await client.query(sql);
        console.log("9-ball columns added successfully.");

        await client.query("NOTIFY pgrst, 'reload schema';");
        console.log("Notified PostgREST to reload schema.");

    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        await client.end();
    }
}

runMigration();
