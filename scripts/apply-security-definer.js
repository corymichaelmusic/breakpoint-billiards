
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
    console.log("Applying Security Definer RLS Fix...");
    const sqlPath = path.join(__dirname, '../supabase/fix_rls_security_definer.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    try {
        const { Client } = require('pg');
        const client = new Client({
            connectionString: process.env.DATABASE_URL,
        });
        await client.connect();
        await client.query(sql);
        await client.end();
        console.log("Security Definer RLS Fix applied successfully via pg client.");
    } catch (e) {
        console.error("Failed to apply migration via pg client:", e);
    }
}

applyMigration();
