
-- EMERGENCY REVERT: Allow all select on league_players to restore dashboard
alter table public.league_players enable row level security;

-- Drop the broken policies
drop policy if exists "Users can view own memberships" on public.league_players;
drop policy if exists "Players can view league members" on public.league_players;
drop policy if exists "Operators can view league_players" on public.league_players;

-- Create Permissive Policy
create policy "Emergency: Allow all select"
  on public.league_players for select
  using (true);
