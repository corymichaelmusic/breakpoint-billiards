-- Fix team match/table RLS policies to support Clerk text user IDs.
-- The original policies used auth.uid()::text, which still attempts to
-- parse the JWT sub as UUID and fails for ids like "user_...".

DROP POLICY IF EXISTS "Admins and Operators can ALL on team_matches" ON public.team_matches;
DROP POLICY IF EXISTS "Admins and Operators can ALL on team_match_sets" ON public.team_match_sets;

DROP POLICY IF EXISTS "Admins can manage all team matches" ON public.team_matches;
DROP POLICY IF EXISTS "Operators can manage team matches in their leagues" ON public.team_matches;
DROP POLICY IF EXISTS "Captains can manage their team matches" ON public.team_matches;

DROP POLICY IF EXISTS "Admins can manage all team match sets" ON public.team_match_sets;
DROP POLICY IF EXISTS "Operators can manage team match sets in their leagues" ON public.team_match_sets;
DROP POLICY IF EXISTS "Captains can manage their team match sets" ON public.team_match_sets;

CREATE POLICY "Admins can manage all team matches"
  ON public.team_matches
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (auth.jwt() ->> 'sub')
        AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (auth.jwt() ->> 'sub')
        AND role = 'admin'
    )
  );

CREATE POLICY "Operators can manage team matches in their leagues"
  ON public.team_matches
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.league_operators lo
      WHERE lo.league_id = team_matches.league_id
        AND lo.user_id = (auth.jwt() ->> 'sub')
    )
    OR EXISTS (
      SELECT 1
      FROM public.leagues l
      WHERE l.id = team_matches.league_id
        AND l.operator_id = (auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.league_operators lo
      WHERE lo.league_id = team_matches.league_id
        AND lo.user_id = (auth.jwt() ->> 'sub')
    )
    OR EXISTS (
      SELECT 1
      FROM public.leagues l
      WHERE l.id = team_matches.league_id
        AND l.operator_id = (auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "Captains can manage their team matches"
  ON public.team_matches
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.teams ta
      WHERE ta.id = team_matches.team_a_id
        AND ta.captain_id = (auth.jwt() ->> 'sub')
    )
    OR EXISTS (
      SELECT 1
      FROM public.teams tb
      WHERE tb.id = team_matches.team_b_id
        AND tb.captain_id = (auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.teams ta
      WHERE ta.id = team_matches.team_a_id
        AND ta.captain_id = (auth.jwt() ->> 'sub')
    )
    OR EXISTS (
      SELECT 1
      FROM public.teams tb
      WHERE tb.id = team_matches.team_b_id
        AND tb.captain_id = (auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "Admins can manage all team match sets"
  ON public.team_match_sets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (auth.jwt() ->> 'sub')
        AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (auth.jwt() ->> 'sub')
        AND role = 'admin'
    )
  );

CREATE POLICY "Operators can manage team match sets in their leagues"
  ON public.team_match_sets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.team_matches tm
      JOIN public.league_operators lo
        ON lo.league_id = tm.league_id
      WHERE tm.id = team_match_sets.team_match_id
        AND lo.user_id = (auth.jwt() ->> 'sub')
    )
    OR EXISTS (
      SELECT 1
      FROM public.team_matches tm
      JOIN public.leagues l
        ON l.id = tm.league_id
      WHERE tm.id = team_match_sets.team_match_id
        AND l.operator_id = (auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.team_matches tm
      JOIN public.league_operators lo
        ON lo.league_id = tm.league_id
      WHERE tm.id = team_match_sets.team_match_id
        AND lo.user_id = (auth.jwt() ->> 'sub')
    )
    OR EXISTS (
      SELECT 1
      FROM public.team_matches tm
      JOIN public.leagues l
        ON l.id = tm.league_id
      WHERE tm.id = team_match_sets.team_match_id
        AND l.operator_id = (auth.jwt() ->> 'sub')
    )
  );

CREATE POLICY "Captains can manage their team match sets"
  ON public.team_match_sets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.team_matches tm
      JOIN public.teams ta
        ON ta.id = tm.team_a_id
      WHERE tm.id = team_match_sets.team_match_id
        AND ta.captain_id = (auth.jwt() ->> 'sub')
    )
    OR EXISTS (
      SELECT 1
      FROM public.team_matches tm
      JOIN public.teams tb
        ON tb.id = tm.team_b_id
      WHERE tm.id = team_match_sets.team_match_id
        AND tb.captain_id = (auth.jwt() ->> 'sub')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.team_matches tm
      JOIN public.teams ta
        ON ta.id = tm.team_a_id
      WHERE tm.id = team_match_sets.team_match_id
        AND ta.captain_id = (auth.jwt() ->> 'sub')
    )
    OR EXISTS (
      SELECT 1
      FROM public.team_matches tm
      JOIN public.teams tb
        ON tb.id = tm.team_b_id
      WHERE tm.id = team_match_sets.team_match_id
        AND tb.captain_id = (auth.jwt() ->> 'sub')
    )
  );
