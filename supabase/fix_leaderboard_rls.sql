
-- Enable RLS on league_players (ensure it's on)
alter table public.league_players enable row level security;

-- DROP Restrictive Policies (if they exist)
drop policy if exists "Users can view own memberships" on public.league_players;
drop policy if exists "Players can view league members" on public.league_players;

-- CREATE Independent Policies

-- 1. Users can view THEIR OWN membership (Base case)
create policy "Users can view own memberships"
  on public.league_players for select
  using (
    player_id = (auth.jwt() ->> 'sub')
  );

-- 2. Users can view OTHER members in the SAME league
-- This allows: "Show me all players where their league_id matches one of MY league_ids"
create policy "Players can view league members"
  on public.league_players for select
  using (
    exists (
      select 1 from public.league_players as my_lp
      where my_lp.player_id = (auth.jwt() ->> 'sub')
      and my_lp.league_id = league_players.league_id
    )
  );

-- (Optional) Operators View Policy is usually handled separately, but ensure it exists
drop policy if exists "Operators can view league_players" on public.league_players;
create policy "Operators can view league_players"
  on public.league_players for select
  using (
    exists (
      select 1 from public.leagues
      where id = league_players.league_id
      and operator_id = (auth.jwt() ->> 'sub')
    )
  );
