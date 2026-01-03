-- Secure League Players View Migration
-- 1. Create a controlled SECURITY DEFINER function to encapsulate restricted reads
CREATE OR REPLACE FUNCTION public.get_league_players_visible(_league_id uuid DEFAULT NULL)
RETURNS SETOF public.league_players
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.league_players lp
  WHERE 
    -- Filter by league_id if provided
    (_league_id IS NULL OR lp.league_id = _league_id)
    AND (
        -- Visibility Logic:
        -- 1. User sees their own membership
        lp.player_id = (select auth.uid()::text)
        OR
        -- 2. Operators see memberships in their leagues
        EXISTS (
            SELECT 1 FROM public.leagues l
            WHERE l.id = lp.league_id
            AND l.operator_id = (select auth.uid()::text)
        )
    );
$$;

-- 2. Tighten permissions on the function
REVOKE ALL ON FUNCTION public.get_league_players_visible(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_league_players_visible(uuid) TO authenticated;

-- 3. Redefine the View as INVOKER (default), simply calling the secure function
-- This creates a privilege boundary: The View (Invoker) calls Function (Definer)
CREATE OR REPLACE VIEW public.v_league_players_visible AS
SELECT * FROM public.get_league_players_visible(NULL::uuid);

-- Grant select on the view to authenticated users (so they can query it)
GRANT SELECT ON public.v_league_players_visible TO authenticated;
