-- Add ball_mapping column to games table to store 9-ball specific assignments
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS ball_mapping JSONB;

-- Example mapping format: { "1": "player_uuid", "9": "winning_player_uuid", "5": "dead" }
