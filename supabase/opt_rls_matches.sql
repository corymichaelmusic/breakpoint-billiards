-- Optimized RLS Policies for Matches Table
-- Wraps auth calls in scalar subqueries (SELECT auth.uid()) for performance

-- 1. "Operators can manage matches"
DROP POLICY IF EXISTS "Operators can manage matches" ON public.matches;

CREATE POLICY "Operators can manage matches"
ON public.matches FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.leagues
    WHERE id = matches.league_id
    AND operator_id = (SELECT auth.uid()::text)
  )
);

-- 2. "Players can submit scores"
DROP POLICY IF EXISTS "Players can submit scores" ON public.matches;

CREATE POLICY "Players can submit scores"
ON public.matches FOR UPDATE
USING (
  (
    (SELECT auth.uid()::text) = player1_id
    OR (SELECT auth.uid()::text) = player2_id
  )
  AND status != 'finalized'
);
