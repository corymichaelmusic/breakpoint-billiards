require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addPrimarySessionColumn() {
    console.log('Adding is_primary column to league_players table...');

    // Add the is_primary column
    const { error: alterError } = await supabase.rpc('exec_sql', {
        sql: `
            ALTER TABLE league_players 
            ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE;
        `
    });

    if (alterError) {
        // Try direct SQL if RPC doesn't exist
        console.log('RPC not available, please run this SQL in Supabase Dashboard:');
        console.log(`
-- Add is_primary column to league_players
ALTER TABLE league_players 
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE;

-- Create partial unique index to ensure only one primary per player
CREATE UNIQUE INDEX IF NOT EXISTS idx_league_players_one_primary_per_player 
ON league_players (player_id) 
WHERE is_primary = TRUE;

-- Set first session as primary for users with no primary set
-- (Run this after adding the column)
WITH first_sessions AS (
    SELECT DISTINCT ON (player_id) 
        league_id, 
        player_id
    FROM league_players lp
    JOIN leagues l ON lp.league_id = l.id
    WHERE l.type = 'session' 
      AND l.status IN ('active', 'setup')
    ORDER BY player_id, lp.joined_at ASC
)
UPDATE league_players lp
SET is_primary = TRUE
FROM first_sessions fs
WHERE lp.player_id = fs.player_id 
  AND lp.league_id = fs.league_id
  AND NOT EXISTS (
      SELECT 1 FROM league_players lp2 
      WHERE lp2.player_id = lp.player_id 
        AND lp2.is_primary = TRUE
  );
        `);
        return;
    }

    console.log('Column added successfully!');

    // Create unique index
    const { error: indexError } = await supabase.rpc('exec_sql', {
        sql: `
            CREATE UNIQUE INDEX IF NOT EXISTS idx_league_players_one_primary_per_player 
            ON league_players (player_id) 
            WHERE is_primary = TRUE;
        `
    });

    if (indexError) {
        console.log('Index creation may need manual intervention:', indexError.message);
    } else {
        console.log('Unique index created!');
    }

    // Set first session as primary for existing users
    const { error: updateError } = await supabase.rpc('exec_sql', {
        sql: `
            WITH first_sessions AS (
                SELECT DISTINCT ON (player_id) 
                    league_id, 
                    player_id
                FROM league_players lp
                JOIN leagues l ON lp.league_id = l.id
                WHERE l.type = 'session' 
                  AND l.status IN ('active', 'setup')
                ORDER BY player_id, lp.joined_at ASC
            )
            UPDATE league_players lp
            SET is_primary = TRUE
            FROM first_sessions fs
            WHERE lp.player_id = fs.player_id 
              AND lp.league_id = fs.league_id
              AND NOT EXISTS (
                  SELECT 1 FROM league_players lp2 
                  WHERE lp2.player_id = lp.player_id 
                    AND lp2.is_primary = TRUE
              );
        `
    });

    if (updateError) {
        console.log('Data migration may need manual intervention:', updateError.message);
    } else {
        console.log('Existing users updated with primary session!');
    }

    console.log('Migration complete!');
}

addPrimarySessionColumn().catch(console.error);
