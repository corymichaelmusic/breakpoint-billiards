BEGIN;

-- 1) Redefine the view with security_invoker = true
-- This clears the Supabase security alert and ensures RLS is respected
-- It matches the logic from v11, just adding the invoker flag
CREATE OR REPLACE VIEW public.v_league_players_visible 
WITH (security_invoker = true)
AS
SELECT lp.*
FROM public.league_players lp
WHERE lp.player_id = (auth.jwt() ->> 'sub')
   OR EXISTS (
     SELECT 1
     FROM public.leagues l
     WHERE l.id = lp.league_id
       AND l.operator_id = (auth.jwt() ->> 'sub')
   );

-- Grant select on the view to authenticated users
GRANT SELECT ON public.v_league_players_visible TO authenticated;

-- 2) Cleanup the old deprecated security definer function if it still exists
DROP FUNCTION IF EXISTS public.get_league_players_visible(uuid);
DROP FUNCTION IF EXISTS public.get_league_players_visible();

COMMIT;
