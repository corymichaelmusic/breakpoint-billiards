
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
    console.log('Updating messages DELETE policy...');

    // Check if we can use PG client directly (preferred for migrations usually)
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

    if (connectionString) {
        console.log("Using PG Client...");
        const client = new Client({
            connectionString,
            ssl: { rejectUnauthorized: false }
        });

        try {
            await client.connect();
            await client.query(`
                DROP POLICY IF EXISTS "Enable delete for own messages" ON messages;
                DROP POLICY IF EXISTS "Enable delete for authors and operators" ON messages;
                
                CREATE POLICY "Enable delete for authors and operators" ON messages
                FOR DELETE
                USING (
                    (auth.jwt() ->> 'sub') = user_id::text
                    OR
                    EXISTS (
                        SELECT 1 FROM profiles
                        WHERE id = (auth.jwt() ->> 'sub')
                        AND (role IN ('operator', 'admin') OR operator_status = 'active')
                    )
                );
            `);
            console.log("Migration successful via PG Client!");
        } catch (e) {
            console.error("PG Client failed:", e);
        } finally {
            await client.end();
        }
        return;
    }

    console.log("No connection string found, trying Supabase RPC...");
    // RPC fallback (usually won't work unless set up, but safe to keep)
    const { error } = await supabase.rpc('pgrst_source_exec', {
        sql: `
            DROP POLICY IF EXISTS "Enable delete for own messages" ON messages;
            DROP POLICY IF EXISTS "Enable delete for authors and operators" ON messages;
            
            CREATE POLICY "Enable delete for authors and operators" ON messages
            FOR DELETE
            USING (
                (auth.jwt() ->> 'sub') = user_id::text
                OR
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE id = (auth.jwt() ->> 'sub')
                    AND (role IN ('operator', 'admin') OR operator_status = 'active')
                )
            );
        `
    });

    if (error) {
        console.error('Migration failed via RPC:', error);
    } else {
        console.log('Migration successful via RPC!');
    }
}

runMigration();
