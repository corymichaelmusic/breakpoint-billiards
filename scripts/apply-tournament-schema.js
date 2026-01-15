const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function applySchema() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false, // Required for Supabase (and many cloud DBs) but check if your config differs
        },
    });

    try {
        await client.connect();
        console.log('Connected to database to apply Tournament Schema');

        const schemaPath = path.join(__dirname, '../supabase/tournament_system_schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Read schema file. Executing SQL...');
        await client.query(schemaSql);
        console.log('Tournament schema executed successfully! 🏆');

    } catch (err) {
        console.error('❌ Error executing schema:', err);
    } finally {
        await client.end();
    }
}

applySchema();
