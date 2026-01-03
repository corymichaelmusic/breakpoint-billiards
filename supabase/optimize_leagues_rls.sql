-- Optimizing "Admins can delete leagues" RLS policy
-- Replacing auth.uid() with scalar subquery (select auth.uid()) to avoid O(n) re-evaluation

drop policy if exists "Admins can delete leagues" on public.leagues;

create policy "Admins can delete leagues"
  on public.leagues for delete
  using ( 
    exists (
      select 1 from public.profiles 
      where id = (select auth.uid()::text) 
      and role = 'admin'
    )
  );
