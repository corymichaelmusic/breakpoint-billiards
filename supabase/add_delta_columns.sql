-- Add delta columns to matches table to support Reset Match functionality
ALTER TABLE matches ADD COLUMN IF NOT EXISTS delta_8ball_p1 numeric DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS delta_8ball_p2 numeric DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS delta_9ball_p1 numeric DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS delta_9ball_p2 numeric DEFAULT 0;
