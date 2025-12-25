
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.league_players;

CREATE POLICY "Users can view their own memberships"
ON public.league_players
FOR SELECT
USING (
  (select auth.jwt() ->> 'sub') = player_id
);
