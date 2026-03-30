-- Fix: Allow players to see all league_players in leagues they are enrolled in
-- 
-- Problem: The "Users can view own memberships" policy only returns the current user's own row,
-- preventing captains from seeing available players for team rosters.
--
-- A direct self-referencing policy causes infinite recursion (league_players RLS evaluating league_players).
-- Solution: Use a SECURITY DEFINER function that bypasses RLS to check league membership.

-- Step 1: Create a helper function (SECURITY DEFINER bypasses RLS, avoiding recursion)
CREATE OR REPLACE FUNCTION public.user_shares_league(check_league_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.league_players
    WHERE league_id = check_league_id
    AND player_id = (SELECT auth.jwt() ->> 'sub')
  );
$$;

-- Step 2: Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view own memberships" ON public.league_players;

-- Step 3: Create the new policy using the helper function
DROP POLICY IF EXISTS "Players can view league co-members" ON public.league_players;
CREATE POLICY "Players can view league co-members"
  ON public.league_players FOR SELECT
  USING (
    public.user_shares_league(league_id)
  );
