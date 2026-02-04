
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error("Please provide a SQL file path.");
        process.exit(1);
    }

    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`Running migration from: ${filePath}`);

    // We can't use .rpc() easily unless we have an 'exec_sql' function. 
    // And we can't use raw SQL via js client on 'public' schema easily without it.
    // HOWEVER, we can use the `pg` library if we had the connection string, typically not exposed here.
    // BUT, Supabase JS client usually doesn't allow raw SQL execution for security.

    // Wait, I saw `check_status.sql` earlier. How do they run it?
    // The user might be running migrations manually or via CLI.

    // Let's check `scripts/` to see if there is an existing migration runner. 
    // Ah, I saw `run-migrations` API route earlier.

    // Actually, I can try to use the REST API via a postgres function if it exists.
    // But wait, if I can't run raw SQL, I can't alter the table.

    // LET'S CHECK if there is a helper function in the DB already.
    // `exec_sql` or similar.

    // If not, I might have to ask the user to run it or use the "Postgres" tab in Supabase dashboard... 
    // OR rely on a known function.

    // Hack: If I cannot run SQL, I cannot fix the constraint.
    // Let's LOOK for a way.

    // I will try to call a standard function if it exists, or fail and Notify User.
    // But wait, `src/app/api/run-migrations` exists? 
    // Let's check `src/app/api/run-migrations` again.

    // For now, I will write this script but it might fail if I don't have an `exec` function.
    // Let's use a widely known method for Supabase projects: `rpc('exec_sql', { sql })` is common if set up.
    // If not, I'll assume we might need to use the `postgres` npm package if the connection string is available in env.

    // Let's check .env.local for DATABASE_URL.

    const { Client } = require('pg');
    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl) {
        console.error("No DATABASE_URL found in .env.local");
        return;
    }

    console.log("RPC failed. Attempting direct connection via pg...");
    const client = new Client({
        connectionString: dbUrl,
    });

    try {
        await client.connect();
        await client.query(sql);
        console.log("Migration successful via pg client.");
    } catch (pgError) {
        console.error("PG Client failed:", pgError);
    } finally {
        await client.end();
    }

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error("RPC exec_sql failed:", error);
        console.log("Trying alternative function name 'exec'...");

        // Try 'exec'
        const { error: execError } = await supabase.rpc('exec', { query: sql });
        if (execError) {
            console.error("RPC exec failed as well.");

            // Final fallback: Instruct user or use postgres node module if available?
            // Let's check package.json for 'pg'.
        } else {
            console.log("Migration successful via 'exec'.");
        }
    } else {
        console.log("Migration successful via 'exec_sql'.");
    }
}

runMigration();
