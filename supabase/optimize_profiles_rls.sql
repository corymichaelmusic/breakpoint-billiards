-- Optimizing RLS policies to use scalar subqueries for performance
-- This prevents auth.uid() from being re-evaluated for every row

-- 1. Insert Policy
drop policy if exists "Users can insert own profile" on public.profiles;

create policy "Users can insert own profile"
  on public.profiles for insert
  with check ( (select auth.uid()::text) = id );

-- 2. Update Policy
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can update own profile"
  on public.profiles for update
  using ( (select auth.uid()::text) = id );

-- Notes: 
-- We wrap auth.uid() in (select ...) to force single evaluation per query.
-- We cast to text because our ID column is text (Clerk ID).
