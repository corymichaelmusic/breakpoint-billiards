-- Enable RLS on league_players
alter table public.league_players enable row level security;

-- Drop existing policies to ensure clean state
drop policy if exists "League memberships are viewable by everyone" on public.league_players;
drop policy if exists "Operators can manage league members" on public.league_players;
drop policy if exists "Players can join leagues" on public.league_players;
drop policy if exists "Players can view own memberships" on public.league_players;
drop policy if exists "Operators can view league memberships" on public.league_players;
drop policy if exists "Operators can manage league memberships" on public.league_players;

-- Policy: Players can view their own memberships
create policy "Players can view own memberships"
  on public.league_players for select
  using ( current_setting('request.jwt.claim.sub', true) = player_id );

-- Policy: Operators can view all memberships in their leagues
create policy "Operators can view league memberships"
  on public.league_players for select
  using (
    exists (
      select 1 from public.leagues
      where id = league_players.league_id
      and operator_id = current_setting('request.jwt.claim.sub', true)
    )
  );

-- Policy: Operators can manage memberships in their leagues
create policy "Operators can manage league memberships"
  on public.league_players for all
  using (
    exists (
      select 1 from public.leagues
      where id = league_players.league_id
      and operator_id = current_setting('request.jwt.claim.sub', true)
    )
  );

-- Policy: Players can join (insert) with pending status
create policy "Players can join leagues"
  on public.league_players for insert
  with check (
    current_setting('request.jwt.claim.sub', true) = player_id
  );
