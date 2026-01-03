-- FIX CLERK ID MISMATCH v11 (Auth UID Fix)
-- The function auth.uid() returns a UUID. Since Clerk IDs are text ('user_...'), calling auth.uid() crashes.
-- We must use (auth.jwt() ->> 'sub') instead, which is TEXT.

BEGIN;

-- 0) PREEMPTIVE CLEANUP (View Dependencies)
DROP VIEW IF EXISTS public.v_league_players_visible CASCADE;

-- 1) DROP ALL POLICIES
DROP POLICY IF EXISTS "Leagues are viewable by everyone" ON public.leagues;
DROP POLICY IF EXISTS "Admins can delete leagues" ON public.leagues;
DROP POLICY IF EXISTS "Operators can create leagues" ON public.leagues;
DROP POLICY IF EXISTS "Operators can update own leagues" ON public.leagues;

DROP POLICY IF EXISTS "Matches are viewable by everyone" ON public.matches;
DROP POLICY IF EXISTS "Users can insert own matches-p1" ON public.matches;
DROP POLICY IF EXISTS "Users can insert own matches-p2" ON public.matches;
DROP POLICY IF EXISTS "Users can update own matches" ON public.matches;
DROP POLICY IF EXISTS "Players can submit scores" ON public.matches;
DROP POLICY IF EXISTS "Operators can manage matches" ON public.matches;

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

DROP POLICY IF EXISTS "Games viewable by everyone" ON public.games;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.games;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.games;
DROP POLICY IF EXISTS "Players and Operators can insert games" ON public.games;
DROP POLICY IF EXISTS "Players and Operators can update games" ON public.games;
DROP POLICY IF EXISTS "Players and Operators can delete games" ON public.games;
DROP POLICY IF EXISTS "Users can insert games linked to their matches" ON public.games;
DROP POLICY IF EXISTS "Users can update games linked to their matches" ON public.games;

DROP POLICY IF EXISTS "Reschedule requests viewable by everyone" ON public.reschedule_requests;
DROP POLICY IF EXISTS "Players can insert reschedule requests" ON public.reschedule_requests;
DROP POLICY IF EXISTS "Opponents can update reschedule requests" ON public.reschedule_requests;
DROP POLICY IF EXISTS "Operators can update reschedule requests" ON public.reschedule_requests;

-- 2) RECREATE POLICIES (Using auth.jwt() ->> 'sub' instead of auth.uid())

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

-- 6) RECREATE VIEW
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

-- 7) FIX FUNCTION (check_match_immutability was using auth.uid())
CREATE OR REPLACE FUNCTION public.check_match_immutability()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow Admins/Service Role
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    -- Check if current user is an Operator (using JWT claim, NOT auth.uid())
    IF EXISTS (
        SELECT 1 FROM public.leagues 
        WHERE id = OLD.league_id 
        AND operator_id = (auth.jwt() ->> 'sub')
    ) THEN
        RETURN NEW; 
    END IF;

    -- Otherwise, assume it's a Player
    IF NEW.id <> OLD.id THEN
        RAISE EXCEPTION 'Cannot modify match ID';
    END IF;
    IF NEW.league_id <> OLD.league_id THEN
        RAISE EXCEPTION 'Cannot modify match League';
    END IF;
    IF NEW.player1_id <> OLD.player1_id OR NEW.player2_id <> OLD.player2_id THEN
        RAISE EXCEPTION 'Cannot modify match Players';
    END IF;
    IF NEW.week_number <> OLD.week_number THEN
        RAISE EXCEPTION 'Cannot modify match Week Number';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


COMMIT;
