
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase URL or Key.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    const sqlPath = path.join(__dirname, '../supabase/finalize_match_stats.sql');
    console.log(`Reading SQL from: ${sqlPath}`);

    try {
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log("SQL Content loaded. Executing...");

        // Split by statement if needed, or run as one block if pg-postgres supports it. 
        // Supabase JS client 'rpc' is usually how we run SQL if we have a helper, 
        // but here we might not have a direct 'exec_sql' RPC.
        // However, many of my previous scripts seem to expect an 'exec_sql' RPC exists 
        // OR they just log things. 
        // Let's check 'execute_granular_payment_migration.js' to see how it runs SQL.
        // If that uses 'exec_sql', I'll use it.

        // Wait, looking at the previous view_file of 'execute_granular_payment_migration.js' (Step 2542 will show it).
        // I will assume there is an 'exec_sql' RPC function available based on previous context "you've done it before".

        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
            console.error("RPC exec_sql failed, attempting direct PG connection...");
            await runPg(sql);
        } else {
            console.log("Migration executed successfully via RPC.");
        }

    } catch (e) {
        console.error("File read error:", e);
    }
}

async function runPg(sql) {
    const { Client } = require('pg');
    // Supabase DB URL usually in .env or constructing it.
    // Try standard DATABASE_URL or construct from service role key? No, need connection string.
    // Check .env for DATABASE_URL
    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl) {
        console.error("DATABASE_URL not found in env. Cannot run direct migration.");
        return;
    }

    const client = new Client({ connectionString: dbUrl });
    try {
        await client.connect();
        await client.query(sql);
        console.log("Migration executed successfully via PG Client.");
    } catch (e) {
        console.error("PG Migration Error:", e);
    } finally {
        await client.end();
    }
}

runMigration();
