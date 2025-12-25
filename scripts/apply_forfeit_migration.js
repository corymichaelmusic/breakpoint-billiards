const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Load env vars from .env.local
const envPath = path.resolve(__dirname, '../.env.local');
const envConfig = require('dotenv').parse(fs.readFileSync(envPath));

const dbUrl = envConfig.DATABASE_URL;

if (!dbUrl) {
    console.error('DATABASE_URL is not defined in .env.local');
    process.exit(1);
}

const client = new Client({
    connectionString: dbUrl,
    ssl: {
        rejectUnauthorized: false
    }
});

async function applyMigration() {
    try {
        await client.connect();

        const sqlPath = path.join(__dirname, '../supabase/add_forfeit_columns.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Applying migration...');
        await client.query(sql);

        console.log('Migration applied successfully.');
    } catch (err) {
        console.error('Error applying migration:', err);
    } finally {
        await client.end();
    }
}

applyMigration();
