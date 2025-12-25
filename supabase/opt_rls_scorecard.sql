-- Optimized RLS Policies for Scorecard Entries Table
-- Wraps auth calls in scalar subqueries for performance
-- Uses auth.jwt() ->> 'sub' to support Clerk text IDs

-- 1. DROP EXISTING POLICIES
DROP POLICY IF EXISTS "Users can insert own scorecard entries" ON public.scorecard_entries;
DROP POLICY IF EXISTS "Users can update own scorecard entries" ON public.scorecard_entries;
DROP POLICY IF EXISTS "Users can delete own scorecard entries" ON public.scorecard_entries;

-- 2. RECREATE POLICIES WITH OPTIMIZED SUBQUERIES

create policy "Users can insert own scorecard entries"
    on public.scorecard_entries for insert
    with check ( ((select auth.jwt()) ->> 'sub') = scorer_id );

create policy "Users can update own scorecard entries"
    on public.scorecard_entries for update
    using ( ((select auth.jwt()) ->> 'sub') = scorer_id );

create policy "Users can delete own scorecard entries"
    on public.scorecard_entries for delete
    using ( ((select auth.jwt()) ->> 'sub') = scorer_id );
