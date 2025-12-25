-- Add initial_breaker_id column to matches table
ALTER TABLE matches ADD COLUMN IF NOT EXISTS initial_breaker_id text;
