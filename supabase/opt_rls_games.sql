-- Optimized RLS Policies for Games Table
-- Fixes performance issue where auth functions were called per-row

-- 1. DROP EXISTING POLICIES
DROP POLICY IF EXISTS "Players and Operators can insert games" ON public.games;
DROP POLICY IF EXISTS "Players and Operators can update games" ON public.games;

-- 2. RECREATE INSERT POLICY WITH SCALAR SUBQUERIES
CREATE POLICY "Players and Operators can insert games"
ON public.games FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.matches m
    LEFT JOIN public.leagues l ON m.league_id = l.id
    WHERE m.id = games.match_id
    AND (
      m.player1_id = (SELECT auth.uid()::text)
      OR m.player2_id = (SELECT auth.uid()::text)
      OR l.operator_id = (SELECT auth.uid()::text)
    )
  )
);

-- 3. RECREATE UPDATE POLICY WITH SCALAR SUBQUERIES
CREATE POLICY "Players and Operators can update games"
ON public.games FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    LEFT JOIN public.leagues l ON m.league_id = l.id
    WHERE m.id = games.match_id
    AND (
      m.player1_id = (SELECT auth.uid()::text)
      OR m.player2_id = (SELECT auth.uid()::text)
      OR l.operator_id = (SELECT auth.uid()::text)
    )
  )
);
