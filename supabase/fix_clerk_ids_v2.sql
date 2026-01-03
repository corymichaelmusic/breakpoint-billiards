-- FIX CLERK ID MISMATCH v2 (Handle RLS Policies)
BEGIN;

-- 1. DROP POLICIES affecting the columns we need to change
DROP POLICY IF EXISTS "Operators can create leagues" ON public.leagues;
DROP POLICY IF EXISTS "Operators can update own leagues" ON public.leagues;
DROP POLICY IF EXISTS "Operators can manage matches" ON public.matches;
DROP POLICY IF EXISTS "Players can submit scores" ON public.matches;
DROP POLICY IF EXISTS "Players can update own scores" ON public.matches; -- Just in case

-- 2. DROP CONSTRAINTS
ALTER TABLE public.leagues DROP CONSTRAINT IF EXISTS leagues_operator_id_fkey;
ALTER TABLE public.league_players DROP CONSTRAINT IF EXISTS league_players_player_id_fkey;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_player1_id_fkey;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_player2_id_fkey;
ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_winner_id_fkey;

-- 3. CONVERT COLUMNS TO TEXT
ALTER TABLE public.leagues ALTER COLUMN operator_id TYPE text;
ALTER TABLE public.league_players ALTER COLUMN player_id TYPE text;
ALTER TABLE public.matches ALTER COLUMN player1_id TYPE text;
ALTER TABLE public.matches ALTER COLUMN player2_id TYPE text;
ALTER TABLE public.games ALTER COLUMN winner_id TYPE text;

DO $$
BEGIN
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'reschedule_requests' AND column_name = 'requester_id') THEN
        ALTER TABLE public.reschedule_requests ALTER COLUMN requester_id TYPE text;
    END IF;
END $$;

-- 4. RESTORE CONSTRAINTS
ALTER TABLE public.leagues ADD CONSTRAINT leagues_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES public.profiles(id);
ALTER TABLE public.league_players ADD CONSTRAINT league_players_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.profiles(id);
ALTER TABLE public.matches ADD CONSTRAINT matches_player1_id_fkey FOREIGN KEY (player1_id) REFERENCES public.profiles(id);
ALTER TABLE public.matches ADD CONSTRAINT matches_player2_id_fkey FOREIGN KEY (player2_id) REFERENCES public.profiles(id);
ALTER TABLE public.games ADD CONSTRAINT games_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.profiles(id);

-- 5. RECREATE POLICIES (Text Compatible)

-- Leagues: Operators can create
CREATE POLICY "Operators can create leagues" ON public.leagues
FOR INSERT WITH CHECK (
    auth.uid() = operator_id
);

-- Leagues: Operators can update own
CREATE POLICY "Operators can update own leagues" ON public.leagues
FOR UPDATE USING (
    auth.uid() = operator_id
);

-- Matches: Operators can manage
CREATE POLICY "Operators can manage matches" ON public.matches
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.leagues l
        WHERE l.id = matches.league_id
        AND l.operator_id = auth.uid()
    )
);

-- Matches: Players can submit scores
-- Note: Logic checks if user is p1 or p2
CREATE POLICY "Players can submit scores" ON public.matches
FOR UPDATE USING (
    auth.uid() = player1_id OR auth.uid() = player2_id
);

-- 6. REFRESH VIEW
CREATE OR REPLACE VIEW public.v_league_players_visible AS
SELECT lp.* FROM public.league_players lp
WHERE lp.player_id = (auth.jwt() ->> 'sub')
OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = lp.league_id AND l.operator_id = (auth.jwt() ->> 'sub'));

COMMIT;
