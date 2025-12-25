
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function runMigration() {
    console.log("Checking for DATABASE_URL...");
    if (!process.env.DATABASE_URL) {
        console.error("Error: DATABASE_URL is not defined in .env.local");
        // Try fallback to verify if users have it in shell?
        // process.exit(1); 
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false,
        },
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        const sqlPath = path.join(__dirname, '../supabase/create_scorecard_table.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing SQL migration...');
        await client.query(sql);
        console.log('Migration executed successfully!');

    } catch (err) {
        console.error('Migration execution failed:', err);
    } finally {
        await client.end();
    }
}

runMigration();
