-- FIX: UUID cast error and missing Captain permissions on team_members
-- 
-- Problem: 
-- 1. Using auth.uid() in RLS policies crashes when the user has a Clerk ID (text) 
-- because auth.uid() returns a UUID type.
-- 2. Captains had no explicit policy to INSERT or DELETE members from their rosters.

-- Step 1: Drop old problematic policies
DROP POLICY IF EXISTS "Admins and Operators can ALL on team_members" ON public.team_members;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.team_members;

-- Step 2: Create new stable policies using Clerk-compatible IDs
-- (auth.jwt() ->> 'sub') returns the ID as text directly.

-- ALL access for Admins
DROP POLICY IF EXISTS "Admins can manage all team members" ON public.team_members;
CREATE POLICY "Admins can manage all team members"
  ON public.team_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (auth.jwt() ->> 'sub')
      AND role = 'admin'
    )
  );

-- ALL access for Operators
DROP POLICY IF EXISTS "Operators can manage team members in their leagues" ON public.team_members;
CREATE POLICY "Operators can manage team members in their leagues"
  ON public.team_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      JOIN public.leagues l ON l.id = t.league_id
      WHERE t.id = team_members.team_id
      AND l.operator_id = (auth.jwt() ->> 'sub')
    )
  );

-- ALL access for Captains (Manage their own team)
DROP POLICY IF EXISTS "Captains can manage their own team members" ON public.team_members;
CREATE POLICY "Captains can manage their own team members"
  ON public.team_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.teams
      WHERE id = team_members.team_id
      AND captain_id = (auth.jwt() ->> 'sub')
    )
  );

-- Basic read access for everyone
DROP POLICY IF EXISTS "Anyone can view team members" ON public.team_members;
CREATE POLICY "Anyone can view team members"
  ON public.team_members FOR SELECT
  USING (true);
