-- Add scored_by column to games table for independent scoring
-- Each player submits their own view of the match, and these aren't shared until verification

ALTER TABLE games ADD COLUMN IF NOT EXISTS scored_by text;

-- Create index for efficient filtering by scorer
CREATE INDEX IF NOT EXISTS idx_games_scored_by ON games(scored_by);

COMMENT ON COLUMN games.scored_by IS 'The player ID (Clerk user_id) who recorded this game result. For dual-device verification, each player scores independently.';
