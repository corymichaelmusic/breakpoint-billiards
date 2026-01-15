
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
    console.log('Applying Guest Player Schema Changes...');

    // 1. Update tournament_participants table
    const sql1 = `
    ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS guest_name TEXT;
    ALTER TABLE tournament_participants ALTER COLUMN player_id DROP NOT NULL;
  `;

    // 2. Drop old FK constraints on matches if they exist
    const sql2 = `
    ALTER TABLE tournament_matches DROP CONSTRAINT IF EXISTS tournament_matches_player1_id_fkey;
    ALTER TABLE tournament_matches DROP CONSTRAINT IF EXISTS tournament_matches_player2_id_fkey;
    ALTER TABLE tournament_matches DROP CONSTRAINT IF EXISTS tournament_matches_winner_id_fkey;
  `;

    // 3. Add new FK constraints referencing participants
    // Note: player1_id now stores the UUID of the PARTICIPANT, not the profile.
    // We need to change the column type if it was TEXT? It was TEXT REFERENCES profiles(id).
    // profiles(id) is UUID usually, but cast as text? Let's check schema.
    // Schema said: player1_id TEXT REFERENCES profiles(id).
    // tournament_participants(id) is UUID. 
    // We should cast player1_id to UUID or keep as TEXT. TEXT is fine to hold UUID.
    const sql3 = `
    ALTER TABLE tournament_matches 
      ADD CONSTRAINT tournament_matches_player1_id_fkey 
      FOREIGN KEY (player1_id) REFERENCES tournament_participants(id);
      
    ALTER TABLE tournament_matches 
      ADD CONSTRAINT tournament_matches_player2_id_fkey 
      FOREIGN KEY (player2_id) REFERENCES tournament_participants(id);

    ALTER TABLE tournament_matches 
      ADD CONSTRAINT tournament_matches_winner_id_fkey 
      FOREIGN KEY (winner_id) REFERENCES tournament_participants(id);
  `;

    // Helper to run SQL (using a function if available, or just direct SQL if enabled?
    // Since we don't have a direct 'query' method exposed usually, we often use a PG client or RPC.
    // Assuming we might have an RPC 'exec_sql' or similar from previous tasks? 
    // Checking user context... No obvious RPC.
    // HOWEVER, I can likely just output this SQL for the user to run, OR use the 'postgres' package if available.
    // But wait, the previous conversation had 'scripts/apply-tournament-schema.js'. How did that work?
    // Let's check 'scripts/apply-tournament-schema.js' content.
    console.log('SQL to run:');
    console.log(sql1);
    console.log(sql2);
    console.log(sql3);
}

run();
