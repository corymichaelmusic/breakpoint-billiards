-- Fix RLS for profiles to handle Clerk IDs (text)
-- Problem: auth.uid() crashes when token 'sub' is not a UUID.

-- 1. INSERT
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
FOR INSERT WITH CHECK ((auth.jwt() ->> 'sub') = id);

-- 2. UPDATE
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE USING ((auth.jwt() ->> 'sub') = id);

-- 3. SELECT (Ensure profiles are visible)
-- Usually profiles are public, check if existing policy covers it.
-- If not, we add a policy for authenticated users to see all profiles.
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
FOR SELECT USING (true);
