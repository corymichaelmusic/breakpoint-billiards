const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function applyFix() {
    console.log('Applying RLS fix...');
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();
        const sqlPath = path.join(__dirname, '../supabase/fix_profiles_rls.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await client.query(sql);
        console.log('RLS fix applied successfully.');
    } catch (err) {
        console.error('Error applying fix:', err);
    } finally {
        await client.end();
    }
}

applyFix();
