require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const sql = `
-- Add is_primary column to league_players
ALTER TABLE league_players 
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE;

-- Create partial unique index to ensure only one primary per player
CREATE UNIQUE INDEX IF NOT EXISTS idx_league_players_one_primary_per_player 
ON league_players (player_id) 
WHERE is_primary = TRUE;

-- Create exec_sql function just in case we need it later
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- Set first session as primary for users with no primary set
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
`;

async function runMigration() {
    console.log('Connecting to database...');
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected!');
        console.log('Running migration SQL...');

        await client.query(sql);

        console.log('Migration executed successfully!');
    } catch (err) {
        console.error('Error running migration:', err);
    } finally {
        await client.end();
    }
}

runMigration();
