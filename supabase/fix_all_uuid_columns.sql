-- Force matches table winner columns to TEXT
-- Drop potential constraints
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_winner_id_8ball_fkey;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_winner_id_9ball_fkey;

-- Change columns to TEXT (safe if already text, handles UUID->Text conversation)
ALTER TABLE matches ALTER COLUMN winner_id_8ball TYPE text USING winner_id_8ball::text;
ALTER TABLE matches ALTER COLUMN winner_id_9ball TYPE text USING winner_id_9ball::text;

-- Re-establish constraints to profiles (which uses text ID)
ALTER TABLE matches ADD CONSTRAINT matches_winner_id_8ball_fkey FOREIGN KEY (winner_id_8ball) REFERENCES public.profiles(id);
ALTER TABLE matches ADD CONSTRAINT matches_winner_id_9ball_fkey FOREIGN KEY (winner_id_9ball) REFERENCES public.profiles(id);
