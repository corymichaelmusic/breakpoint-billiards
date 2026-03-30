-- Fix: Allow players to see profiles of others in the same league.
-- 
-- Problem: The "Profiles are viewable by everyone" policy restricts visibility to 
-- players who have already played matches (matches_played > 0). 
-- New players (like the dummy players) who are enrolled in a league but haven't played 
-- are hidden from others. The inner join in the mobile app's "available players" 
-- query then filters them out entirely.
--
-- Solution: Add a check for league membership to the profiles select policy.

-- Step 1: Create a helper function to check if the current user shares any league with another user.
-- Use SECURITY DEFINER to avoid RLS recursion in league_players.
CREATE OR REPLACE FUNCTION public.share_any_league(other_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.league_players lp1
    JOIN public.league_players lp2 ON lp1.league_id = lp2.league_id
    WHERE lp1.player_id = other_user_id
    AND lp2.player_id = (SELECT auth.jwt() ->> 'sub')
  );
$$;

-- Step 2: Update the profiles SELECT policy.
-- We keep the existing criteria (is_active, matches played, own profile) 
-- and add the league membership check.
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (
    (is_active = true) AND (
      (id = (SELECT auth.jwt() ->> 'sub')) OR 
      check_has_played(id) OR 
      public.share_any_league(id)
    )
  );

-- Also add a policy for Operators to view profiles of players in their leagues
DROP POLICY IF EXISTS "Operators can view profiles in their leagues" ON public.profiles;
CREATE POLICY "Operators can view profiles in their leagues"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.league_players lp
      JOIN public.leagues l ON l.id = lp.league_id
      WHERE lp.player_id = public.profiles.id
      AND l.operator_id = (SELECT auth.jwt() ->> 'sub')
    )
  );
