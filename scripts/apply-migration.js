const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function applyMigration() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Supabase requires SSL
    });

    try {
        await client.connect();
        console.log("Connected to database.");

        const sqlPath = path.join(__dirname, '../supabase/update_role_check.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log("Applying migration...");
        await client.query(sql);
        console.log("Migration applied successfully.");

    } catch (err) {
        console.error("Error applying migration:", err);
    } finally {
        await client.end();
    }
}

applyMigration();
