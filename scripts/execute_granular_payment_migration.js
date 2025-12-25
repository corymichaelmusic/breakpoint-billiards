
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    const sqlPath = path.join(__dirname, '../supabase/add_granular_payment_columns.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log("Executing SQL Migration...");
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql }); // Try RPC first if enabled

    if (error) {
        // Fallback or just log if RPC not found
        console.warn("RPC failed (likely disabled), trying direct query if PG client available... or User needs to run manually.");
        // Since we don't have direct PG in this context widely, we might rely on the 'exec_sql' extension if present.
        // Assuming we rely on the user or the 'pg' library if installed. 
        // Let's assume we can't easily auto-run SQL without the extension.
        // But wait, we can try to use the 'pg' library as we did in previous scripts.
        runPg(sql);
    } else {
        console.log("Migration Success via RPC!");
    }
}

async function runPg(sql) {
    const { Client } = require('pg');
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("DATABASE_URL not found, cannot run migration.");
        return;
    }
    const client = new Client({ connectionString: dbUrl });
    try {
        await client.connect();
        await client.query(sql);
        console.log("Migration Success via PG!");
    } catch (e) {
        console.error("PG Migration Error:", e);
    } finally {
        await client.end();
    }
}

runMigration();
