const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function applyMigration() {
    console.log("Connecting to remote database...");
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();
        console.log("Connected.");

        const sql = `
            ALTER TABLE public.profiles 
            ADD COLUMN IF NOT EXISTS push_token text DEFAULT NULL;
        `;

        console.log("Applying migration: Add push_token column...");
        await client.query(sql);
        console.log("Migration applied successfully!");

    } catch (err) {
        console.error("Error applying migration:", err);
    } finally {
        await client.end();
    }
}

applyMigration();
