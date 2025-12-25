-- Add missing DELETE policy for games table
DROP POLICY IF EXISTS "Players and Operators can delete games" ON public.games;

CREATE POLICY "Players and Operators can delete games"
ON public.games FOR DELETE
USING (
  EXISTS (
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
