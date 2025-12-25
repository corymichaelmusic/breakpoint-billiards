
-- Temporary: Allow all access to league_players to debug RLS issues
drop policy if exists "Debug: Allow all select" on public.league_players;

create policy "Debug: Allow all select"
  on public.league_players for select
  using ( true );
