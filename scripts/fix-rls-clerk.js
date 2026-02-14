
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runFix() {
    console.log('Connecting to database to fix RLS...');
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const sql = `
            -- Drop old policies that used auth.uid() which fails for Clerk IDs
            DROP POLICY IF EXISTS "Enable read access for session members" ON messages;
            DROP POLICY IF EXISTS "Enable insert access for session members" ON messages;
            DROP POLICY IF EXISTS "Enable delete for own messages" ON messages;

            -- Re-create policies using (auth.jwt() ->> 'sub')
            
            -- Read Policy
            CREATE POLICY "Enable read access for session members" ON messages
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM league_players lp
                    WHERE lp.league_id = messages.league_id
                    AND lp.player_id = (auth.jwt() ->> 'sub') -- Clerk ID
                    AND lp.status = 'active'
                )
            );

            -- Insert Policy
            CREATE POLICY "Enable insert access for session members" ON messages
            FOR INSERT
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM league_players lp
                    WHERE lp.league_id = messages.league_id
                    AND lp.player_id = (auth.jwt() ->> 'sub')
                    AND lp.status = 'active'
                )
                -- Also ensure the user_id in the message matches the authenticated user
                AND user_id = (auth.jwt() ->> 'sub')
            );

            -- Delete Policy
            CREATE POLICY "Enable delete for own messages" ON messages
            FOR DELETE
            USING (user_id = (auth.jwt() ->> 'sub'));
        `;

        console.log('Executing SQL to fix policies...');
        await client.query(sql);
        console.log("RLS Fix successful!");

    } catch (err) {
        console.error('Fix Error:', err);
    } finally {
        await client.end();
    }
}

runFix();
