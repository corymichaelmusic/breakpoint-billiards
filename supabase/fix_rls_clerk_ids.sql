
-- Fix RLS policies to support Clerk IDs (text) instead of Supabase UUIDs
-- Problem: auth.uid() crashes when token 'sub' is not a UUID.
-- Solution: Use (auth.jwt() ->> 'sub') to read ID as text.

-- 1. Scorecard Entries
DROP POLICY IF EXISTS "Users can insert own scorecard entries" ON public.scorecard_entries;
CREATE POLICY "Users can insert own scorecard entries" ON public.scorecard_entries 
FOR INSERT WITH CHECK ((auth.jwt() ->> 'sub') = scorer_id);

DROP POLICY IF EXISTS "Users can update own scorecard entries" ON public.scorecard_entries;
CREATE POLICY "Users can update own scorecard entries" ON public.scorecard_entries 
FOR UPDATE USING ((auth.jwt() ->> 'sub') = scorer_id);

DROP POLICY IF EXISTS "Users can delete own scorecard entries" ON public.scorecard_entries;
CREATE POLICY "Users can delete own scorecard entries" ON public.scorecard_entries 
FOR DELETE USING ((auth.jwt() ->> 'sub') = scorer_id);

-- 2. Matches (Proactive fix, assuming similar issue exists or will exist)
DROP POLICY IF EXISTS "Users can insert own matches-p1" ON public.matches;
CREATE POLICY "Users can insert own matches-p1" ON public.matches 
FOR INSERT WITH CHECK ((auth.jwt() ->> 'sub') = player1_id);

DROP POLICY IF EXISTS "Users can insert own matches-p2" ON public.matches;
CREATE POLICY "Users can insert own matches-p2" ON public.matches 
FOR INSERT WITH CHECK ((auth.jwt() ->> 'sub') = player2_id);

DROP POLICY IF EXISTS "Users can update own matches" ON public.matches;
CREATE POLICY "Users can update own matches" ON public.matches 
FOR UPDATE USING ((auth.jwt() ->> 'sub') IN (player1_id, player2_id));

