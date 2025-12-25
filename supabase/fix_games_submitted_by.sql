-- Fix games table submitted_by column to be text (Clerk ID)
ALTER TABLE games
DROP CONSTRAINT IF EXISTS games_submitted_by_fkey;

ALTER TABLE games
ALTER COLUMN submitted_by TYPE text;

ALTER TABLE games
ADD CONSTRAINT games_submitted_by_fkey
FOREIGN KEY (submitted_by) REFERENCES profiles(id);
