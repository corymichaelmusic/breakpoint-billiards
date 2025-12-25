
-- Function to get the current user ID safely (works for Clerk text IDs)
create or replace function public.get_current_user_id()
returns text
language sql
stable
as $$
  select (auth.jwt() ->> 'sub');
$$;

-- Function to check if current user is the operator of a league (Security Definer)
-- This bypasses RLS on the 'leagues' table to ensure the check always succeeds if data exists
create or replace function public.is_league_operator(_league_id uuid)
returns boolean
language plpgsql
security definer
as $$
begin
  return exists (
    select 1
    from public.leagues
    where id = _league_id
    and operator_id = public.get_current_user_id()
  );
end;
$$;

-- Update RLS Policies to use the function

-- 1. League Players
alter table public.league_players enable row level security;

drop policy if exists "Operators can view league_players" on public.league_players;
create policy "Operators can view league_players"
  on public.league_players for select
  using ( public.is_league_operator(league_id) );

drop policy if exists "Operators can update league_players" on public.league_players;
create policy "Operators can update league_players"
  on public.league_players for update
  using ( public.is_league_operator(league_id) );

drop policy if exists "Operators can delete league_players" on public.league_players;
create policy "Operators can delete league_players"
  on public.league_players for delete
  using ( public.is_league_operator(league_id) );

-- Keep the "Users can view own memberships" policy
drop policy if exists "Users can view own memberships" on public.league_players;
create policy "Users can view own memberships"
  on public.league_players for select
  using ( player_id = public.get_current_user_id() );

-- 2. Matches (Update to use function too for consistency)
drop policy if exists "Operators can manage matches" on public.matches;
create policy "Operators can manage matches"
  on public.matches for all
  using ( public.is_league_operator(league_id) );

-- 3. Leagues (Update to use helper)
drop policy if exists "Operators can create leagues" on public.leagues;
create policy "Operators can create leagues"
  on public.leagues for insert
  with check ( operator_id = public.get_current_user_id() );

drop policy if exists "Operators can update own leagues" on public.leagues;
create policy "Operators can update own leagues"
  on public.leagues for update
  using ( operator_id = public.get_current_user_id() );
