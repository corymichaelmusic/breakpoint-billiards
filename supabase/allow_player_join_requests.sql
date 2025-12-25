
-- Drop the policy using auth.uid()
DROP POLICY IF EXISTS "Players can request to join" ON public.league_players;

-- Re-create using auth.jwt() ->> 'sub' to handle non-UUID IDs (Clerk)
CREATE POLICY "Players can request to join"
ON public.league_players
FOR INSERT
WITH CHECK (
  (select auth.jwt() ->> 'sub') = player_id
);
