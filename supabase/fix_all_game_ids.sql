-- Force all ID columns in games table to TEXT
-- Drop potential UUID constraints
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_winner_id_fkey;
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_submitted_by_fkey;
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_breaker_id_fkey;

-- Change columns to TEXT (safe if already text)
ALTER TABLE games ALTER COLUMN winner_id TYPE text USING winner_id::text;
ALTER TABLE games ALTER COLUMN submitted_by TYPE text USING submitted_by::text;
ALTER TABLE games ALTER COLUMN breaker_id TYPE text USING breaker_id::text;

-- Re-establish constraints to profiles (which uses text ID)
-- Note: referenced table profiles(id) is text.
ALTER TABLE games ADD CONSTRAINT games_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.profiles(id);
ALTER TABLE games ADD CONSTRAINT games_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.profiles(id);
ALTER TABLE games ADD CONSTRAINT games_breaker_id_fkey FOREIGN KEY (breaker_id) REFERENCES public.profiles(id);
