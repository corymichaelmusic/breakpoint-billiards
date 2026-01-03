-- FIX PROFILES UUID TO TEXT MIGRATION [FINAL V5 NUCLEAR]
-- This script drops ALL policies on ALL tables involved to prevent "column used in policy" errors.

BEGIN;

-- 0) PREEMPTIVE CLEANUP (View Dependencies)
DROP VIEW IF EXISTS public.v_league_players_visible CASCADE;

-- 1) DROP ALL POLICIES (Exhaustive List)
-- Profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;

-- System Settings
DROP POLICY IF EXISTS "Admins can update system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Everyone can read system settings" ON public.system_settings;

-- Leagues
DROP POLICY IF EXISTS "Leagues are viewable by everyone" ON public.leagues;
DROP POLICY IF EXISTS "Admins can delete leagues" ON public.leagues;
DROP POLICY IF EXISTS "Operators can create leagues" ON public.leagues;
DROP POLICY IF EXISTS "Operators can update own leagues" ON public.leagues;

-- Matches
DROP POLICY IF EXISTS "Matches are viewable by everyone" ON public.matches;
DROP POLICY IF EXISTS "Users can insert own matches-p1" ON public.matches;
DROP POLICY IF EXISTS "Users can insert own matches-p2" ON public.matches;
DROP POLICY IF EXISTS "Users can update own matches" ON public.matches;
DROP POLICY IF EXISTS "Players can submit scores" ON public.matches;
DROP POLICY IF EXISTS "Operators can manage matches" ON public.matches;

-- League Players
DROP POLICY IF EXISTS "League memberships are viewable by everyone" ON public.league_players;
DROP POLICY IF EXISTS "Players can view own memberships" ON public.league_players;
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.league_players;
DROP POLICY IF EXISTS "Users can view own memberships" ON public.league_players;
DROP POLICY IF EXISTS "Players can join leagues" ON public.league_players;
DROP POLICY IF EXISTS "Operators can view league memberships" ON public.league_players;
DROP POLICY IF EXISTS "Operators can manage league memberships" ON public.league_players;
DROP POLICY IF EXISTS "Operators can view league_players" ON public.league_players;
DROP POLICY IF EXISTS "Operators can update league_players" ON public.league_players;
DROP POLICY IF EXISTS "Operators can delete league_players" ON public.league_players;
DROP POLICY IF EXISTS "Players can view league members" ON public.league_players;
DROP POLICY IF EXISTS "Debug: Allow all select" ON public.league_players;
DROP POLICY IF EXISTS "Players can request to join" ON public.league_players;

-- Games
DROP POLICY IF EXISTS "Games viewable by everyone" ON public.games;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.games;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.games;
DROP POLICY IF EXISTS "Players and Operators can insert games" ON public.games;
DROP POLICY IF EXISTS "Players and Operators can update games" ON public.games;
DROP POLICY IF EXISTS "Players and Operators can delete games" ON public.games;
DROP POLICY IF EXISTS "Users can insert games linked to their matches" ON public.games;
DROP POLICY IF EXISTS "Users can update games linked to their matches" ON public.games;

-- Reschedule Requests
DROP POLICY IF EXISTS "Reschedule requests viewable by everyone" ON public.reschedule_requests;
DROP POLICY IF EXISTS "Players can insert reschedule requests" ON public.reschedule_requests;
DROP POLICY IF EXISTS "Opponents can update reschedule requests" ON public.reschedule_requests;
DROP POLICY IF EXISTS "Operators can update reschedule requests" ON public.reschedule_requests;
DROP POLICY IF EXISTS "Players can view reschedule requests" ON public.reschedule_requests;

-- 2) DROP RELYING FOREIGN KEYS (Exhaustive List)
ALTER TABLE public.leagues DROP CONSTRAINT IF EXISTS leagues_operator_id_fkey;
ALTER TABLE public.league_players DROP CONSTRAINT IF EXISTS league_players_player_id_fkey;

-- Matches Constraints
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_player1_id_fkey;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_player2_id_fkey;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_submitted_by_fkey;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_winner_id_8ball_fkey;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_winner_id_9ball_fkey;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_forfeited_by_fkey;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_coin_flip_winner_id_fkey;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_current_turn_id_fkey;

-- Games Constraints
ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_winner_id_fkey;
ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_submitted_by_fkey;
ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_breaker_id_fkey;

-- Other Constraints
ALTER TABLE public.reschedule_requests DROP CONSTRAINT IF EXISTS reschedule_requests_requester_id_fkey;

-- 3) ALTER PROFILES TABLE (The Root Cause)
ALTER TABLE public.profiles ALTER COLUMN id TYPE text;

-- 4) ENSURE CHILD COLUMNS ARE TEXT
ALTER TABLE public.leagues ALTER COLUMN operator_id TYPE text;
ALTER TABLE public.league_players ALTER COLUMN player_id TYPE text;

ALTER TABLE public.matches ALTER COLUMN player1_id TYPE text;
ALTER TABLE public.matches ALTER COLUMN player2_id TYPE text;
ALTER TABLE public.matches ALTER COLUMN submitted_by TYPE text;

-- Handle potential missing columns defensively
DO $$ 
BEGIN
    -- Matches optional columns
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='winner_id_8ball') THEN
        ALTER TABLE public.matches ALTER COLUMN winner_id_8ball TYPE text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='winner_id_9ball') THEN
        ALTER TABLE public.matches ALTER COLUMN winner_id_9ball TYPE text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='forfeited_by') THEN
        ALTER TABLE public.matches ALTER COLUMN forfeited_by TYPE text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='coin_flip_winner_id') THEN
        ALTER TABLE public.matches ALTER COLUMN coin_flip_winner_id TYPE text;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='current_turn_id') THEN
        ALTER TABLE public.matches ALTER COLUMN current_turn_id TYPE text;
    END IF;

    -- Games optional columns
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='submitted_by') THEN
        ALTER TABLE public.games ALTER COLUMN submitted_by TYPE text;
    END IF;
     IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='breaker_id') THEN
        ALTER TABLE public.games ALTER COLUMN breaker_id TYPE text;
    END IF;
END $$;

ALTER TABLE public.games ALTER COLUMN winner_id TYPE text;
ALTER TABLE public.reschedule_requests ALTER COLUMN requester_id TYPE text;

-- 5) RE-ADD FOREIGN KEYS
ALTER TABLE public.leagues ADD CONSTRAINT leagues_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES public.profiles(id);
ALTER TABLE public.league_players ADD CONSTRAINT league_players_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.profiles(id);

ALTER TABLE public.matches ADD CONSTRAINT matches_player1_id_fkey FOREIGN KEY (player1_id) REFERENCES public.profiles(id);
ALTER TABLE public.matches ADD CONSTRAINT matches_player2_id_fkey FOREIGN KEY (player2_id) REFERENCES public.profiles(id);
ALTER TABLE public.matches ADD CONSTRAINT matches_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.profiles(id);

-- Re-add optional Foreign Keys only if columns exist
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='winner_id_8ball') THEN
        ALTER TABLE public.matches ADD CONSTRAINT matches_winner_id_8ball_fkey FOREIGN KEY (winner_id_8ball) REFERENCES public.profiles(id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='winner_id_9ball') THEN
        ALTER TABLE public.matches ADD CONSTRAINT matches_winner_id_9ball_fkey FOREIGN KEY (winner_id_9ball) REFERENCES public.profiles(id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='forfeited_by') THEN
         ALTER TABLE public.matches ADD CONSTRAINT matches_forfeited_by_fkey FOREIGN KEY (forfeited_by) REFERENCES public.profiles(id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='coin_flip_winner_id') THEN
         ALTER TABLE public.matches ADD CONSTRAINT matches_coin_flip_winner_id_fkey FOREIGN KEY (coin_flip_winner_id) REFERENCES public.profiles(id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='current_turn_id') THEN
         ALTER TABLE public.matches ADD CONSTRAINT matches_current_turn_id_fkey FOREIGN KEY (current_turn_id) REFERENCES public.profiles(id);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='submitted_by') THEN
        ALTER TABLE public.games ADD CONSTRAINT games_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.profiles(id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='breaker_id') THEN
        ALTER TABLE public.games ADD CONSTRAINT games_breaker_id_fkey FOREIGN KEY (breaker_id) REFERENCES public.profiles(id);
    END IF;
END $$;

ALTER TABLE public.games ADD CONSTRAINT games_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.profiles(id);
ALTER TABLE public.reschedule_requests ADD CONSTRAINT reschedule_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.profiles(id);

-- 6) RECREATE POLICIES (All-inclusive)

-- PROFILES
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((SELECT auth.uid())::text = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((SELECT auth.uid())::text = id);

-- SYSTEM SETTINGS
CREATE POLICY "Everyone can read system settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Admins can update system settings" ON public.system_settings FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid())::text AND role = 'admin'));

-- LEAGUES
CREATE POLICY "Leagues are viewable by everyone" ON public.leagues FOR SELECT USING (true);
CREATE POLICY "Operators can create leagues" ON public.leagues FOR INSERT WITH CHECK ((SELECT auth.uid())::text = operator_id);
CREATE POLICY "Operators can update own leagues" ON public.leagues FOR UPDATE USING ((SELECT auth.uid())::text = operator_id);

-- MATCHES
CREATE POLICY "Matches are viewable by everyone" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Operators can manage matches" ON public.matches FOR ALL USING (EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = matches.league_id AND l.operator_id = (SELECT auth.uid())::text));
CREATE POLICY "Players can submit scores" ON public.matches FOR UPDATE USING ((SELECT auth.uid())::text = player1_id OR (SELECT auth.uid())::text = player2_id);

-- LEAGUE PLAYERS
CREATE POLICY "League memberships are viewable by everyone" ON public.league_players FOR SELECT USING (true);
CREATE POLICY "Players can view own memberships" ON public.league_players FOR SELECT USING ((SELECT auth.uid())::text = player_id);
CREATE POLICY "Operators can view league memberships" ON public.league_players FOR SELECT USING (EXISTS (SELECT 1 FROM public.leagues WHERE id = league_players.league_id AND operator_id = (SELECT auth.uid())::text));
CREATE POLICY "Operators can manage league memberships" ON public.league_players FOR ALL USING (EXISTS (SELECT 1 FROM public.leagues WHERE id = league_players.league_id AND operator_id = (SELECT auth.uid())::text));
CREATE POLICY "Players can join leagues" ON public.league_players FOR INSERT WITH CHECK ((SELECT auth.uid())::text = player_id);

-- GAMES
CREATE POLICY "Games viewable by everyone" ON public.games FOR SELECT USING (true);
CREATE POLICY "Players and Operators can insert games" ON public.games FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.matches m LEFT JOIN public.leagues l ON m.league_id = l.id WHERE m.id = games.match_id AND (m.player1_id = (SELECT auth.uid())::text OR m.player2_id = (SELECT auth.uid())::text OR l.operator_id = (SELECT auth.uid())::text)));
CREATE POLICY "Players and Operators can update games" ON public.games FOR UPDATE USING (EXISTS (SELECT 1 FROM public.matches m LEFT JOIN public.leagues l ON m.league_id = l.id WHERE m.id = games.match_id AND (m.player1_id = (SELECT auth.uid())::text OR m.player2_id = (SELECT auth.uid())::text OR l.operator_id = (SELECT auth.uid())::text)));
CREATE POLICY "Players and Operators can delete games" ON public.games FOR DELETE USING (EXISTS (SELECT 1 FROM public.matches m LEFT JOIN public.leagues l ON m.league_id = l.id WHERE m.id = games.match_id AND (m.player1_id = (SELECT auth.uid())::text OR m.player2_id = (SELECT auth.uid())::text OR l.operator_id = (SELECT auth.uid())::text)));

-- RESCHEDULE REQUESTS
CREATE POLICY "Reschedule requests viewable by everyone" ON public.reschedule_requests FOR SELECT USING (true);
CREATE POLICY "Players can insert reschedule requests" ON public.reschedule_requests FOR INSERT WITH CHECK ((SELECT auth.uid())::text = requester_id);
CREATE POLICY "Opponents can update reschedule requests" ON public.reschedule_requests FOR UPDATE USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = reschedule_requests.match_id AND ((SELECT auth.uid())::text = m.player1_id OR (SELECT auth.uid())::text = m.player2_id)));
CREATE POLICY "Operators can update reschedule requests" ON public.reschedule_requests FOR ALL USING (EXISTS (SELECT 1 FROM public.matches m JOIN public.leagues l ON m.league_id = l.id WHERE m.id = reschedule_requests.match_id AND l.operator_id = (SELECT auth.uid())::text));

-- 7) RECREATE VIEW
CREATE OR REPLACE VIEW public.v_league_players_visible AS
SELECT lp.*
FROM public.league_players lp
WHERE lp.player_id = (auth.jwt() ->> 'sub')
   OR EXISTS (
     SELECT 1
     FROM public.leagues l
     WHERE l.id = lp.league_id
       AND l.operator_id = (auth.jwt() ->> 'sub')
   );

COMMIT;
