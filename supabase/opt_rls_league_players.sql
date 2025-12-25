-- Optimized RLS Policies for League Players Table
-- Wraps auth calls in scalar subqueries for performance
-- Uses auth.jwt() ->> 'sub' to support Clerk text IDs

-- 1. DROP EXISTING POLICIES
DROP POLICY IF EXISTS "Players can join leagues" ON public.league_players;
DROP POLICY IF EXISTS "Players can view own memberships" ON public.league_players;
DROP POLICY IF EXISTS "Operators can view league memberships" ON public.league_players;
DROP POLICY IF EXISTS "Operators can manage league memberships" ON public.league_players;
DROP POLICY IF EXISTS "League memberships are viewable by everyone" ON public.league_players;
DROP POLICY IF EXISTS "Operators can manage league members" ON public.league_players;

-- 2. RECREATE POLICIES WITH OPTIMIZED SUBQUERIES

-- Policy: Players can view their own memberships (or allow SELECT for all if needed, but restricting is better)
-- Wait, if we drop "League memberships are viewable by everyone", we MUST ensure players can see their own.
CREATE POLICY "Players can view own memberships"
  ON public.league_players FOR SELECT
  USING ( ((SELECT auth.jwt()) ->> 'sub') = player_id );

-- Policy: Operators can view all memberships in their leagues
-- Optimized subquery for operator_id check
CREATE POLICY "Operators can view league memberships"
  ON public.league_players FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leagues
      WHERE id = league_players.league_id
      AND operator_id = ((SELECT auth.jwt()) ->> 'sub')
    )
  );

-- Policy: Operators can manage memberships in their leagues (Update/Delete/Insert?)
CREATE POLICY "Operators can manage league memberships"
  ON public.league_players FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.leagues
      WHERE id = league_players.league_id
      AND operator_id = ((SELECT auth.jwt()) ->> 'sub')
    )
  );

-- Policy: Players can join (insert) with pending status (or active depending on default)
CREATE POLICY "Players can join leagues"
  ON public.league_players FOR INSERT
  WITH CHECK (
    ((SELECT auth.jwt()) ->> 'sub') = player_id
  );
