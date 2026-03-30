-- EMERGENCY ROLLBACK
-- Restore stability by removing complex/recursive policies.

-- 1. Profiles: Restore to original simple logic
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT 
USING ( (is_active = true) AND ( (id = (auth.jwt() ->> 'sub')) OR check_has_played(id) ) );

DROP POLICY IF EXISTS "Operators can view profiles in their leagues" ON public.profiles;

-- 2. League Players: Restore to simple logic
DROP POLICY IF EXISTS "Players can view league co-members" ON public.league_players;
DROP POLICY IF EXISTS "Players can view co-members" ON public.league_players;
DROP POLICY IF EXISTS "Authenticated users can view league_players" ON public.league_players;

CREATE POLICY "Users can view own memberships" ON public.league_players FOR SELECT 
USING ( player_id = (auth.jwt() ->> 'sub') );

-- 3. Cleanup new functions
DROP FUNCTION IF EXISTS public.user_shares_league(uuid);
DROP FUNCTION IF EXISTS public.share_any_league(text);
