-- FIX PROFILES UUID TO TEXT MIGRATION [FINAL V7 JWT FIX]
-- The function auth.uid() returns a UUID. This crashes when the JWT contains a Clerk ID (Text).
-- This script replaces all RLS policies to use (auth.jwt() ->> 'sub') instead of auth.uid().

BEGIN;

-- 1) DYNAMICALLY DROP ALL POLICIES AGAIN (To be safe)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('profiles', 'leagues', 'league_players', 'matches', 'games', 'reschedule_requests', 'system_settings')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- 2) RECREATE POLICIES USING (auth.jwt() ->> 'sub') INSTEAD OF auth.uid()

-- PROFILES
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.jwt() ->> 'sub') = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.jwt() ->> 'sub') = id);

-- SYSTEM SETTINGS
CREATE POLICY "Everyone can read system settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Admins can update system settings" ON public.system_settings FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (auth.jwt() ->> 'sub') AND role = 'admin'));

-- LEAGUES
CREATE POLICY "Leagues are viewable by everyone" ON public.leagues FOR SELECT USING (true);
CREATE POLICY "Operators can create leagues" ON public.leagues FOR INSERT WITH CHECK ((auth.jwt() ->> 'sub') = operator_id);
CREATE POLICY "Operators can update own leagues" ON public.leagues FOR UPDATE USING ((auth.jwt() ->> 'sub') = operator_id);

-- MATCHES
CREATE POLICY "Matches are viewable by everyone" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Operators can manage matches" ON public.matches FOR ALL USING (EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = matches.league_id AND l.operator_id = (auth.jwt() ->> 'sub')));
CREATE POLICY "Players can submit scores" ON public.matches FOR UPDATE USING ((auth.jwt() ->> 'sub') = player1_id OR (auth.jwt() ->> 'sub') = player2_id);

-- LEAGUE PLAYERS
CREATE POLICY "League memberships are viewable by everyone" ON public.league_players FOR SELECT USING (true);
CREATE POLICY "Players can view own memberships" ON public.league_players FOR SELECT USING ((auth.jwt() ->> 'sub') = player_id);
CREATE POLICY "Operators can view league memberships" ON public.league_players FOR SELECT USING (EXISTS (SELECT 1 FROM public.leagues WHERE id = league_players.league_id AND operator_id = (auth.jwt() ->> 'sub')));
CREATE POLICY "Operators can manage league memberships" ON public.league_players FOR ALL USING (EXISTS (SELECT 1 FROM public.leagues WHERE id = league_players.league_id AND operator_id = (auth.jwt() ->> 'sub')));
CREATE POLICY "Players can join leagues" ON public.league_players FOR INSERT WITH CHECK ((auth.jwt() ->> 'sub') = player_id);

-- GAMES
CREATE POLICY "Games viewable by everyone" ON public.games FOR SELECT USING (true);
CREATE POLICY "Players and Operators can insert games" ON public.games FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.matches m LEFT JOIN public.leagues l ON m.league_id = l.id WHERE m.id = games.match_id AND (m.player1_id = (auth.jwt() ->> 'sub') OR m.player2_id = (auth.jwt() ->> 'sub') OR l.operator_id = (auth.jwt() ->> 'sub'))));
CREATE POLICY "Players and Operators can update games" ON public.games FOR UPDATE USING (EXISTS (SELECT 1 FROM public.matches m LEFT JOIN public.leagues l ON m.league_id = l.id WHERE m.id = games.match_id AND (m.player1_id = (auth.jwt() ->> 'sub') OR m.player2_id = (auth.jwt() ->> 'sub') OR l.operator_id = (auth.jwt() ->> 'sub'))));
CREATE POLICY "Players and Operators can delete games" ON public.games FOR DELETE USING (EXISTS (SELECT 1 FROM public.matches m LEFT JOIN public.leagues l ON m.league_id = l.id WHERE m.id = games.match_id AND (m.player1_id = (auth.jwt() ->> 'sub') OR m.player2_id = (auth.jwt() ->> 'sub') OR l.operator_id = (auth.jwt() ->> 'sub'))));

-- RESCHEDULE REQUESTS
CREATE POLICY "Reschedule requests viewable by everyone" ON public.reschedule_requests FOR SELECT USING (true);
CREATE POLICY "Players can insert reschedule requests" ON public.reschedule_requests FOR INSERT WITH CHECK ((auth.jwt() ->> 'sub') = requester_id);
CREATE POLICY "Opponents can update reschedule requests" ON public.reschedule_requests FOR UPDATE USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = reschedule_requests.match_id AND ((auth.jwt() ->> 'sub') = m.player1_id OR (auth.jwt() ->> 'sub') = m.player2_id)));
CREATE POLICY "Operators can update reschedule requests" ON public.reschedule_requests FOR ALL USING (EXISTS (SELECT 1 FROM public.matches m JOIN public.leagues l ON m.league_id = l.id WHERE m.id = reschedule_requests.match_id AND l.operator_id = (auth.jwt() ->> 'sub')));

-- 3) RECREATE VIEW (Also using safe JWT access)
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
