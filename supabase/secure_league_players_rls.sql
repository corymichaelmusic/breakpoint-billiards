
-- Remove the debug "Allow All" policy
drop policy if exists "Debug: Allow all select" on public.league_players;

-- Ensure RLS is enabled
alter table public.league_players enable row level security;

-- Policy 1: Users can view their own memberships
drop policy if exists "Users can view own memberships" on public.league_players;

create policy "Users can view own memberships"
  on public.league_players for select
  using ( player_id = auth.uid()::text );

-- Policy 2: Operators can view memberships for leagues/sessions they own
drop policy if exists "Operators can view league_players" on public.league_players;

create policy "Operators can view league_players"
  on public.league_players for select
  using (
    exists (
      select 1 from public.leagues
      where id = league_players.league_id
      and operator_id = auth.uid()::text
    )
  );

-- Policy 3: Operators can update memberships (Approve/Reject)
drop policy if exists "Operators can update league_players" on public.league_players;

create policy "Operators can update league_players"
  on public.league_players for update
  using (
    exists (
      select 1 from public.leagues
      where id = league_players.league_id
      and operator_id = auth.uid()::text
    )
  );

-- Policy 4: Operators can delete memberships (Reject/Remove)
drop policy if exists "Operators can delete league_players" on public.league_players;

create policy "Operators can delete league_players"
  on public.league_players for delete
  using (
    exists (
      select 1 from public.leagues
      where id = league_players.league_id
      and operator_id = auth.uid()::text
    )
  );
