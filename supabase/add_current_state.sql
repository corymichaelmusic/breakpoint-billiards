-- Add current_state column to matches for realtime syncing of incomplete games
ALTER TABLE matches ADD COLUMN IF NOT EXISTS current_state jsonb;
