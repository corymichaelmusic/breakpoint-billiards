const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function updateSchema() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const sqlPath = path.join(__dirname, '../supabase/update_schema_split_matches.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split by semicolon to execute statements individually if needed, 
    // but Postgres usually handles the block. 
    // Supabase SQL editor might need raw execution.
    // We'll try executing the whole block.

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        // If RPC fails (often does if not set up), try direct query via pg or just log manual instruction
        console.error('RPC Error:', error);
        console.log('Attempting to run via direct SQL execution is not supported by supabase-js client directly without RPC.');
        console.log('Please run the contents of supabase/update_schema_split_matches.sql in your Supabase SQL Editor.');
    } else {
        console.log('Schema updated successfully via RPC.');
    }
}

// Fallback: Since we don't have RPC set up for arbitrary SQL usually, 
// we will use the 'pg' library if available or just instruct the user.
// But wait, I have the 'pg' library in the project.

const { Client } = require('pg');

async function runPg() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const sqlPath = path.join(__dirname, '../supabase/update_schema_split_matches.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await client.query(sql);
        console.log('Schema updated successfully via PG client.');
    } catch (err) {
        console.error('PG Error:', err);
    } finally {
        await client.end();
    }
}

runPg();
