
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function runMigration() {
    if (!process.env.DATABASE_URL) {
        console.error("Error: DATABASE_URL not found.");
        process.exit(1);
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();
        const sql = fs.readFileSync(path.join(__dirname, '../supabase/add_paid_column.sql'), 'utf8');
        await client.query(sql);
        console.log("Migration 'add_paid_column' applied successfully.");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await client.end();
    }
}

runMigration();
