-- Add columns to track 8-ball and 9-ball separately
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS status_8ball text DEFAULT 'scheduled',
ADD COLUMN IF NOT EXISTS status_9ball text DEFAULT 'scheduled',
ADD COLUMN IF NOT EXISTS race_8ball_p1 int,
ADD COLUMN IF NOT EXISTS race_8ball_p2 int,
ADD COLUMN IF NOT EXISTS race_9ball_p1 int,
ADD COLUMN IF NOT EXISTS race_9ball_p2 int,
ADD COLUMN IF NOT EXISTS points_8ball_p1 int DEFAULT 0,
ADD COLUMN IF NOT EXISTS points_8ball_p2 int DEFAULT 0,
ADD COLUMN IF NOT EXISTS points_9ball_p1 int DEFAULT 0,
ADD COLUMN IF NOT EXISTS points_9ball_p2 int DEFAULT 0;

-- Update games table to distinguish game type
ALTER TABLE games
ADD COLUMN IF NOT EXISTS game_type text DEFAULT '8ball';
