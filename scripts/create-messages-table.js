
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = require('dotenv').parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
    console.log('Running messages table migration...');

    // 1. Create table
    const createTableQuery = `
    CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        content TEXT NOT NULL CHECK (char_length(content) > 0),
        created_at TIMESTAMPTZ DEFAULT now()
    );

    -- Enable RLS
    ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

    -- Create Policy: View messages (Members Only)
    -- A user can see messages if they are a 'league_player' in that league
    DROP POLICY IF EXISTS "Enable read access for session members" ON messages;
    CREATE POLICY "Enable read access for session members" ON messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM league_players lp
            WHERE lp.league_id = messages.league_id
            AND lp.player_id = auth.uid()
            AND lp.status = 'active'
        )
    );

    -- Create Policy: Insert messages (Members Only)
    DROP POLICY IF EXISTS "Enable insert access for session members" ON messages;
    CREATE POLICY "Enable insert access for session members" ON messages
    FOR INSERT
    WITH CHECK (
         EXISTS (
            SELECT 1 FROM league_players lp
            WHERE lp.league_id = messages.league_id
            AND lp.player_id = auth.uid()
            AND lp.status = 'active'
        )
        AND auth.uid() = user_id
    );

    -- Allow users to delete their own messages (Optional but good)
    DROP POLICY IF EXISTS "Enable delete for own messages" ON messages;
    CREATE POLICY "Enable delete for own messages" ON messages
    FOR DELETE
    USING (auth.uid() = user_id);
    `;

    const { error } = await supabase.rpc('pgrst_source_exec', { sql: createTableQuery })
        .catch(async () => {
            // Fallback if rpc not available (unlikely for admin, but safe)
            // We can use a direct SQL via REST if enabled, but usually we don't have that.
            // Given the context of this project, we are likely running locally or have admin access.
            // If RPC fails, we might need another way.
            // Let's assume standard direct sql execution isn't exposed and just try to use a standard query if possible,
            // OR just report we need to run it manually.
            // Wait, the standard Supabase JS client doesn't support raw SQL unless via RPC.
            // Let's try to infer if we have a 'exec_sql' or similar function from previous scripts.
            // Checking 'scripts/setup-db.js' usually reveals how they run SQL.
            console.log("RPC 'pgrst_source_exec' might be missing. Trying standard pg connection if available or different RPC.");
            return { error: { message: "RPC failed, will try alternative." } };
        });

    // Actually, looking at previous conversation/scripts, they use a direct pg connection or a specific RPC?
    // Let's look at `scripts/setup-db.js` or `scripts/execute_migration.js` to be sure how to run SQL.
    // I will write this file, but pause execution to check `scripts/execute_migration.js` before running it,
    // so I can ensure I use the correct execution method.

    return { error }; // Placeholder return
}

// We will actually implement the standard 'pg' approach as seen in other scripts to be safe.
const { Client } = require('pg');
async function runPgMigration() {
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL; // Try standard env vars
    if (!connectionString) {
        console.error("No POSTGRES_URL found in .env.local");
        return;
    }

    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const sql = `
            CREATE TABLE IF NOT EXISTS messages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                content TEXT NOT NULL CHECK (char_length(content) > 0),
                created_at TIMESTAMPTZ DEFAULT now()
            );

            ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

            DROP POLICY IF EXISTS "Enable read access for session members" ON messages;
            CREATE POLICY "Enable read access for session members" ON messages
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM league_players lp
                    WHERE lp.league_id = messages.league_id
                    AND lp.player_id = auth.uid()::text
                    AND lp.status = 'active'
                )
            );

            DROP POLICY IF EXISTS "Enable insert access for session members" ON messages;
            CREATE POLICY "Enable insert access for session members" ON messages
            FOR INSERT
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM league_players lp
                    WHERE lp.league_id = messages.league_id
                    AND lp.player_id = auth.uid()::text
                    AND lp.status = 'active'
                )
                AND auth.uid()::text = user_id
            );

             DROP POLICY IF EXISTS "Enable delete for own messages" ON messages;
            CREATE POLICY "Enable delete for own messages" ON messages
            FOR DELETE
            USING (auth.uid()::text = user_id);
        `;

        await client.query(sql);
        console.log("Migration successful!");
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        await client.end();
    }
}

runPgMigration();
