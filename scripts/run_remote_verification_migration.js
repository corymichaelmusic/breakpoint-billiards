
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    if (!process.env.DATABASE_URL) {
        console.error("Error: DATABASE_URL not found in .env.local");
        process.exit(1);
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Required for Supabase
    });

    try {
        await client.connect();
        console.log("Connected to database.");

        const sqlPath = path.join(__dirname, '../supabase/feature_remote_verification.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log("Executing SQL migration...");
        await client.query(sql);
        console.log("Migration executed successfully.");

    } catch (err) {
        console.error("Error executing migration:", err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();
