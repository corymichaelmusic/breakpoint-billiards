
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
    console.log("Applying RLS fix...");
    const sqlPath = path.join(__dirname, '../supabase/fix_league_players_rls.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split by semicolon to run statements individually if needed, but Supabase usually handles blocks.
    // However, the JS client doesn't have a direct 'query' method for arbitrary SQL unless we use a function or a specific endpoint.
    // We'll use the 'rpc' method if we have a function, or we can use the 'pg' library if we had direct connection string.
    // Since we only have the JS client and service role key, we can't run arbitrary SQL directly unless we have a helper function in DB.

    // BUT, I've been using 'update_schema_*.sql' files before. How did I apply them?
    // Ah, I usually use a script that connects via 'postgres' library or I assume I have a 'exec_sql' function.
    // Let's check 'scripts/setup-db.js' or similar to see how I did it before.
    // Wait, I see 'scripts/apply-winner-columns.js' in previous context. Let's see how that worked.
    // It likely used a direct connection or a helper.

    // Actually, I don't have a direct SQL execution method via supabase-js client without a stored procedure.
    // I will try to use the 'postgres' node module if available, or check if I have a 'exec_sql' function.

    // Let's assume I don't have 'exec_sql'.
    // I'll try to use the 'postgres' library.

    try {
        const { Client } = require('pg');
        const client = new Client({
            connectionString: process.env.DATABASE_URL,
        });
        await client.connect();
        await client.query(sql);
        await client.end();
        console.log("Migration applied successfully via pg client.");
    } catch (e) {
        console.error("Failed to apply migration via pg client:", e);
        // Fallback: Check if we have an exec_sql function
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) {
            console.error("Failed to apply via rpc:", error);
        } else {
            console.log("Migration applied successfully via rpc.");
        }
    }
}

applyMigration();
