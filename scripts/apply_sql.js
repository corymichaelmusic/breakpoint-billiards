const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function applySQL() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        const files = [
            'supabase/finalize_match_stats.sql',
            'supabase/submit_match_for_verification.sql'
        ];

        for (const file of files) {
            console.log(`Executing ${file}...`);
            const sql = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
            await client.query(sql);
            console.log(`Successfully executed ${file}.`);
        }

    } catch (err) {
        console.error('Error applying SQL:', err);
    } finally {
        await client.end();
    }
}

applySQL();
