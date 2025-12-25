const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
    const sqlPath = path.join(__dirname, '../supabase/update_schema_split_timing.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        // If exec_sql is not available, try direct connection/query purely via pg if we had it, 
        // but here we might need to rely on the user or existing capability.
        // Actually, I can use the 'pg' library as I did before.
        console.error('Supabase RPC failed, trying PG client...');

        const { Client } = require('pg');
        const client = new Client({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        try {
            await client.connect();
            await client.query(sql);
            console.log('Migration applied successfully via PG');
        } catch (pgError) {
            console.error('Migration failed:', pgError);
        } finally {
            await client.end();
        }
    } else {
        console.log('Migration applied successfully via RPC');
    }
}

applyMigration();
