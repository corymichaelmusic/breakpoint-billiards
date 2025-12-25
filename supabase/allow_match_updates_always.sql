-- Allow players to update matches even if status is 'finalized' (to correct scores)
DROP POLICY IF EXISTS "Players can submit scores" ON public.matches;

CREATE POLICY "Players can submit scores"
ON public.matches FOR UPDATE
USING (
  (select auth.jwt() ->> 'sub') = player1_id 
  OR (select auth.jwt() ->> 'sub') = player2_id
);
