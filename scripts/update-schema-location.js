const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase URL or Service Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
    const sqlPath = path.join(__dirname, '../supabase/update_schema_location.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        // If exec_sql is not available (it's a custom function), we might need another way or just use the dashboard.
        // But since I've used it before (presumably), I'll try. 
        // Wait, I don't think I have exec_sql. I usually use the 'pg' client for migrations in this env.
        console.error('RPC Error:', error);

        // Fallback to pg
        const { Client } = require('pg');
        const client = new Client({
            connectionString: process.env.DATABASE_URL,
        });

        try {
            await client.connect();
            await client.query(sql);
            console.log('Migration applied successfully via PG');
        } catch (pgError) {
            console.error('PG Error:', pgError);
        } finally {
            await client.end();
        }
    } else {
        console.log('Migration applied successfully via RPC');
    }
}

runMigration();
