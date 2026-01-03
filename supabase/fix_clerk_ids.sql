-- FIX CLERK ID MISMATCH (UUID -> TEXT)
-- This script converts foreign keys referencing profiles.id to TEXT to support "user_..." Clerk IDs.

BEGIN;

-- 1. Drop constraints (Foreign Keys) to allow type change
-- We attempt to drop standard naming conventions.
ALTER TABLE public.leagues DROP CONSTRAINT IF EXISTS leagues_operator_id_fkey;
ALTER TABLE public.league_players DROP CONSTRAINT IF EXISTS league_players_player_id_fkey;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_player1_id_fkey;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_player2_id_fkey;
ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_winner_id_fkey;
ALTER TABLE public.reschedule_requests DROP CONSTRAINT IF EXISTS reschedule_requests_requester_id_fkey;

-- 2. Convert Columns to TEXT
ALTER TABLE public.leagues ALTER COLUMN operator_id TYPE text;
ALTER TABLE public.league_players ALTER COLUMN player_id TYPE text;
ALTER TABLE public.matches ALTER COLUMN player1_id TYPE text;
ALTER TABLE public.matches ALTER COLUMN player2_id TYPE text;
ALTER TABLE public.games ALTER COLUMN winner_id TYPE text;

-- Reschedule Requests (if column exists)
DO $$
BEGIN
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'reschedule_requests' AND column_name = 'requester_id') THEN
        ALTER TABLE public.reschedule_requests ALTER COLUMN requester_id TYPE text;
    END IF;
END $$;


-- 3. Re-Add Foreign Key Constraints
-- These ensure data integrity now that both sides are TEXT.

ALTER TABLE public.leagues 
    ADD CONSTRAINT leagues_operator_id_fkey 
    FOREIGN KEY (operator_id) REFERENCES public.profiles(id);

ALTER TABLE public.league_players 
    ADD CONSTRAINT league_players_player_id_fkey 
    FOREIGN KEY (player_id) REFERENCES public.profiles(id);

ALTER TABLE public.matches 
    ADD CONSTRAINT matches_player1_id_fkey 
    FOREIGN KEY (player1_id) REFERENCES public.profiles(id);

ALTER TABLE public.matches 
    ADD CONSTRAINT matches_player2_id_fkey 
    FOREIGN KEY (player2_id) REFERENCES public.profiles(id);

ALTER TABLE public.games 
    ADD CONSTRAINT games_winner_id_fkey 
    FOREIGN KEY (winner_id) REFERENCES public.profiles(id);

-- 4. Update Views (Force Recompile)
-- Sometimes views cache the underlying column types.
CREATE OR REPLACE VIEW public.v_league_players_visible AS
SELECT lp.*
FROM public.league_players lp
WHERE
  lp.player_id = (auth.jwt() ->> 'sub')
  OR
  EXISTS (
    SELECT 1
    FROM public.leagues l
    WHERE l.id = lp.league_id
      AND l.operator_id = (auth.jwt() ->> 'sub')
  );

COMMIT;
