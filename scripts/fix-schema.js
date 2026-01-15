const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function applyFix() {
    console.log('Using DB URL:', process.env.DATABASE_URL ? 'Found' : 'Missing');
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false,
        },
    });

    try {
        await client.connect();
        console.log('Connected to database to apply Fix');

        const schemaPath = path.join(__dirname, '../supabase/fix_match_fks.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Read fix SQL file. Executing...');
        await client.query(schemaSql);
        console.log('Fix executed successfully! ✅');

    } catch (err) {
        console.error('❌ Error executing fix:', err);
    } finally {
        await client.end();
    }
}

applyFix();
