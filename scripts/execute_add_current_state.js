const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../mobile/.env') });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');


const supabase = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function executeMigration() {
    console.log('Adding current_state column...');
    const sql = fs.readFileSync(path.join(__dirname, '../supabase/add_current_state.sql'), 'utf8');

    // Split execution? No, it's simple.
    // We cannot run SQL directly via client-js easily without rpc or simple query if enabled.
    // Using pg client is better if available, but assuming user env is consistent with previous scripts.
    // The previous scripts used a "pg" client or supabase text query.
    // I'll use the 'pg' client approach from previous scripts (e.g. execute_reset.js) if possible, 
    // or just try to use the user's tool preference.
    // Wait, I can use the same pattern as `execute_reset.js`.

    // Actually, I'll essentially trust the user to have PG installed as seen in context.
    const { Client } = require('pg');
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        await client.query(sql);
        console.log('Migration executed successfully.');

        // Notify PostgREST to reload schema
        await client.query("NOTIFY pgrst, 'reload schema';");
        console.log('Schema reload notified.');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

executeMigration();
