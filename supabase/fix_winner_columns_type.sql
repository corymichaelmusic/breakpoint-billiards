-- Drop foreign key constraints first
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_winner_id_8ball_fkey;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_winner_id_9ball_fkey;

-- Change winner_id columns to text to support Clerk IDs
ALTER TABLE matches 
ALTER COLUMN winner_id_8ball TYPE text,
ALTER COLUMN winner_id_9ball TYPE text;
