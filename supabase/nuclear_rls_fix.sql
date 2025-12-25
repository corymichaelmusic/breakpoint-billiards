-- Nuclear RLS Fix: Drop all policies on games and matches and recreate them using strictly TEXT-based ID checks.

-- 1. GAMES TABLE
DROP POLICY IF EXISTS "Games viewable by everyone" ON public.games;
DROP POLICY IF EXISTS "Players and Operators can insert games" ON public.games;
DROP POLICY IF EXISTS "Players and Operators can update games" ON public.games;
-- Also drop any other potential policy names
DROP POLICY IF EXISTS "Enable read access for all users" ON public.games;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.games;

CREATE POLICY "Games viewable by everyone"
ON public.games FOR SELECT
USING ( true );

CREATE POLICY "Players and Operators can insert games"
ON public.games FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.matches m
    LEFT JOIN public.leagues l ON m.league_id = l.id
    WHERE m.id = games.match_id
    AND (
      m.player1_id = (select auth.jwt() ->> 'sub')
      OR m.player2_id = (select auth.jwt() ->> 'sub')
      OR l.operator_id = (select auth.jwt() ->> 'sub')
    )
  )
);

CREATE POLICY "Players and Operators can update games"
ON public.games FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    LEFT JOIN public.leagues l ON m.league_id = l.id
    WHERE m.id = games.match_id
    AND (
      m.player1_id = (select auth.jwt() ->> 'sub')
      OR m.player2_id = (select auth.jwt() ->> 'sub')
      OR l.operator_id = (select auth.jwt() ->> 'sub')
    )
  )
);

-- 2. MATCHES TABLE
DROP POLICY IF EXISTS "Matches are viewable by everyone" ON public.matches;
DROP POLICY IF EXISTS "Operators can manage matches" ON public.matches;
DROP POLICY IF EXISTS "Players can submit scores" ON public.matches;

CREATE POLICY "Matches are viewable by everyone"
ON public.matches FOR SELECT
USING ( true );

CREATE POLICY "Operators can manage matches"
ON public.matches FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.leagues
    WHERE id = matches.league_id
    AND operator_id = (select auth.jwt() ->> 'sub')
  )
);

CREATE POLICY "Players can submit scores"
ON public.matches FOR UPDATE
USING (
  (
    (select auth.jwt() ->> 'sub') = player1_id 
    OR (select auth.jwt() ->> 'sub') = player2_id
  )
  AND status != 'finalized'
);
