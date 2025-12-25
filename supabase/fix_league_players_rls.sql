
-- Enable RLS on league_players if not already enabled
alter table public.league_players enable row level security;

-- Policy: Operators can view league_players for leagues they own
-- This covers both League Orgs and Sessions (since sessions have operator_id set)
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

-- Policy: Operators can update league_players (approve/reject)
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

-- Policy: Operators can delete league_players (reject/remove)
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
