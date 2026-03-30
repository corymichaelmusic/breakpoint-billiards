-- SAFE RLS FIX: Fix team roster "Available Players" list visibility 
-- 
-- Goal: Ensure new players (who haven't played matches yet) can have their names 
-- visible to others in the same session without causing infinite recursion in RLS.

-- 1. League Players: Grant simple read access to all authenticated users.
-- This table only maps player IDs to league IDs. By allowing simple read for 
-- authenticated users, we break the circular dependency on the 'leagues' table.
DROP POLICY IF EXISTS "Users can view own memberships" ON public.league_players;
DROP POLICY IF EXISTS "Authenticated users can read all enrollments" ON public.league_players;
CREATE POLICY "Authenticated users can read all enrollments" ON public.league_players 
FOR SELECT USING (auth.role() = 'authenticated');

-- 2. Profiles Helper: Use a SEC DEFINER function to check enrollment.
-- This function skips the RLS check on league_players but is only a lookup.
CREATE OR REPLACE FUNCTION public.check_is_enrolled(_player_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.league_players 
    WHERE player_id = _player_id
  );
$$;

-- 3. Profiles: Update visibility rule.
-- We keep existing rules (is active, self profile, already played) 
-- and add "is currently enrolled in any league" via the helper.
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles 
FOR SELECT USING (
  (is_active = true) AND (
    (id = (auth.jwt() ->> 'sub')) OR 
    check_has_played(id) OR 
    check_is_enrolled(id)
  )
);

-- Note: We are NOT using 'leagues' or other shared tables in these policies,
-- which completely avoids the infinite recursion detected earlier.
