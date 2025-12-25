-- 1. Fix NULL submitted_by values (use winner_id as fallback)
UPDATE public.games 
SET submitted_by = winner_id 
WHERE submitted_by IS NULL AND winner_id IS NOT NULL;

-- 2. Update DELETE policy to act on winner_id as well
DROP POLICY IF EXISTS "Players and Operators can delete games" ON public.games;

CREATE POLICY "Players and Operators can delete games"
ON public.games FOR DELETE
USING (
  (select auth.jwt() ->> 'sub') = winner_id
  OR (select auth.jwt() ->> 'sub') = submitted_by
  OR EXISTS (
    SELECT 1 FROM public.matches m
    LEFT JOIN public.leagues l ON m.league_id = l.id
    WHERE m.id = games.match_id
    AND (
      m.player1_id = (select auth.jwt() ->> 'sub')
      OR m.player2_id = (select auth.jwt() ->> 'sub')
      OR l.operator_id = (select auth.jwt() ->> 'sub')
    )
  )
);
