
-- Drop existing policy if it exists (we might need to check the name first, but let's try to be safe)
drop policy if exists "Operators can delete own leagues" on public.leagues;
drop policy if exists "Operators can delete leagues" on public.leagues;

-- Create new policy: Only Admins can delete leagues
create policy "Admins can delete leagues"
  on public.leagues for delete
  using ( 
    exists (select 1 from public.profiles where id = auth.uid()::text and role = 'admin')
  );
