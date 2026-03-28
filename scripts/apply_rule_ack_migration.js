require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function applyMigration() {
    console.log('Adding bylaws_agreed and bis_rules_agreed to profiles table via pg connector...');

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected to PG. Executing DDL...");
        await client.query("ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bylaws_agreed boolean DEFAULT false;");
        await client.query("ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bis_rules_agreed boolean DEFAULT false;");
        console.log("Success! Added the columns.");

        console.log("Reloading PostgREST schema cache...");
        await client.query("NOTIFY pgrst, 'reload schema'");
        console.log("Schema cache reloaded successfully!");
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        await client.end();
    }
}

applyMigration();
