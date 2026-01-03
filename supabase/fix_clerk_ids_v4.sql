-- FIX CLERK ID MISMATCH v4 (Handle ALL RLS Policies + Games)
BEGIN;

-- 1. DROP ALL BLOCKING POLICIES
-- Drop EVERYTHING on affected tables to be safe
DROP POLICY IF EXISTS "Operators can create leagues" ON public.leagues;
DROP POLICY IF EXISTS "Operators can update own leagues" ON public.leagues;
DROP POLICY IF EXISTS "Operators can manage matches" ON public.matches;
DROP POLICY IF EXISTS "Players can submit scores" ON public.matches;
DROP POLICY IF EXISTS "Players can update own scores" ON public.matches;

-- League Players Policies
DROP POLICY IF EXISTS "League memberships are viewable by everyone" ON public.league_players;
DROP POLICY IF EXISTS "Operators can manage league members" ON public.league_players;
DROP POLICY IF EXISTS "Players can join leagues" ON public.league_players;
DROP POLICY IF EXISTS "Players can view own memberships" ON public.league_players;
DROP POLICY IF EXISTS "Operators can view league memberships" ON public.league_players;
DROP POLICY IF EXISTS "Operators can manage league memberships" ON public.league_players;

-- Games Policies (The ones blocking us in V3)
DROP POLICY IF EXISTS "Players and Operators can insert games" ON public.games;
DROP POLICY IF EXISTS "Players and Operators can update games" ON public.games;


-- 2. DROP CONSTRAINTS
ALTER TABLE public.leagues DROP CONSTRAINT IF EXISTS leagues_operator_id_fkey;
ALTER TABLE public.league_players DROP CONSTRAINT IF EXISTS league_players_player_id_fkey;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_player1_id_fkey;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_player2_id_fkey;
ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_winner_id_fkey;
ALTER TABLE public.reschedule_requests DROP CONSTRAINT IF EXISTS reschedule_requests_requester_id_fkey;

-- 3. CONVERT COLUMNS TO TEXT
ALTER TABLE public.leagues ALTER COLUMN operator_id TYPE text;
ALTER TABLE public.league_players ALTER COLUMN player_id TYPE text;
ALTER TABLE public.matches ALTER COLUMN player1_id TYPE text;
ALTER TABLE public.matches ALTER COLUMN player2_id TYPE text;
ALTER TABLE public.games ALTER COLUMN winner_id TYPE text;
ALTER TABLE public.reschedule_requests ALTER COLUMN requester_id TYPE text;

-- 4. RESTORE CONSTRAINTS
ALTER TABLE public.leagues ADD CONSTRAINT leagues_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES public.profiles(id);
ALTER TABLE public.league_players ADD CONSTRAINT league_players_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.profiles(id);
ALTER TABLE public.matches ADD CONSTRAINT matches_player1_id_fkey FOREIGN KEY (player1_id) REFERENCES public.profiles(id);
ALTER TABLE public.matches ADD CONSTRAINT matches_player2_id_fkey FOREIGN KEY (player2_id) REFERENCES public.profiles(id);
ALTER TABLE public.games ADD CONSTRAINT games_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.profiles(id);

-- 5. RECREATE POLICIES (Updated for Text IDs)

-- LEAGUES
CREATE POLICY "Operators can create leagues" ON public.leagues FOR INSERT WITH CHECK (auth.uid() = operator_id);
CREATE POLICY "Operators can update own leagues" ON public.leagues FOR UPDATE USING (auth.uid() = operator_id);

-- MATCHES
CREATE POLICY "Operators can manage matches" ON public.matches FOR ALL USING (EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = matches.league_id AND l.operator_id = auth.uid()));
CREATE POLICY "Players can submit scores" ON public.matches FOR UPDATE USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- LEAGUE PLAYERS
CREATE POLICY "Players can view own memberships" ON public.league_players FOR SELECT USING (auth.uid() = player_id); 
CREATE POLICY "Operators can view league memberships" ON public.league_players FOR SELECT USING (EXISTS (SELECT 1 FROM public.leagues WHERE id = league_players.league_id AND operator_id = auth.uid()));
CREATE POLICY "Operators can manage league memberships" ON public.league_players FOR ALL USING (EXISTS (SELECT 1 FROM public.leagues WHERE id = league_players.league_id AND operator_id = auth.uid()));
CREATE POLICY "Players can join leagues" ON public.league_players FOR INSERT WITH CHECK (auth.uid() = player_id);

-- GAMES (Recreating with Text Casting handling / Native Text)
CREATE POLICY "Players and Operators can insert games" ON public.games FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.matches m
    LEFT JOIN public.leagues l ON m.league_id = l.id
    WHERE m.id = games.match_id
    AND (m.player1_id = auth.uid() OR m.player2_id = auth.uid() OR l.operator_id = auth.uid())
  )
);

CREATE POLICY "Players and Operators can update games" ON public.games FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    LEFT JOIN public.leagues l ON m.league_id = l.id
    WHERE m.id = games.match_id
    AND (m.player1_id = auth.uid() OR m.player2_id = auth.uid() OR l.operator_id = auth.uid())
  )
);

-- 6. REFRESH VIEW
CREATE OR REPLACE VIEW public.v_league_players_visible AS
SELECT lp.* FROM public.league_players lp
WHERE lp.player_id = (auth.jwt() ->> 'sub')
OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = lp.league_id AND l.operator_id = (auth.jwt() ->> 'sub'));

COMMIT;
