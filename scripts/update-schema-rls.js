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
    const sqlPath = path.join(__dirname, '../supabase/update_schema_rls.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Fallback to pg
    const { Client } = require('pg');
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        await client.query(sql);
        console.log('RLS Migration applied successfully via PG');
    } catch (pgError) {
        console.error('PG Error:', pgError);
    } finally {
        await client.end();
    }
}

runMigration();
