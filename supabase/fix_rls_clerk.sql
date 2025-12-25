
-- Fix RLS policies to handle Clerk IDs (text) instead of Supabase UUIDs
-- auth.uid() casts to UUID, which fails for Clerk IDs like 'user_...'

-- Helper to get the current user ID as text from the JWT
-- We can just use (select auth.jwt() ->> 'sub') in the policies

-- 1. League Players Policies
drop policy if exists "Operators can view league_players" on public.league_players;
create policy "Operators can view league_players"
  on public.league_players for select
  using (
    exists (
      select 1 from public.leagues
      where id = league_players.league_id
      and operator_id = (select auth.jwt() ->> 'sub')
    )
  );

drop policy if exists "Operators can update league_players" on public.league_players;
create policy "Operators can update league_players"
  on public.league_players for update
  using (
    exists (
      select 1 from public.leagues
      where id = league_players.league_id
      and operator_id = (select auth.jwt() ->> 'sub')
    )
  );

drop policy if exists "Operators can delete league_players" on public.league_players;
create policy "Operators can delete league_players"
  on public.league_players for delete
  using (
    exists (
      select 1 from public.leagues
      where id = league_players.league_id
      and operator_id = (select auth.jwt() ->> 'sub')
    )
  );

drop policy if exists "Users can view own memberships" on public.league_players;
create policy "Users can view own memberships"
  on public.league_players for select
  using ( player_id = (select auth.jwt() ->> 'sub') );

-- 2. Leagues Policies (Fixing these too just in case, though creation uses Admin client)
drop policy if exists "Operators can create leagues" on public.leagues;
create policy "Operators can create leagues"
  on public.leagues for insert
  with check ( 
    operator_id = (select auth.jwt() ->> 'sub')
  );

drop policy if exists "Operators can update own leagues" on public.leagues;
create policy "Operators can update own leagues"
  on public.leagues for update
  using ( operator_id = (select auth.jwt() ->> 'sub') );

-- 3. Matches Policies
drop policy if exists "Operators can manage matches" on public.matches;
create policy "Operators can manage matches"
  on public.matches for all
  using ( 
    exists (
      select 1 from public.leagues 
      where id = matches.league_id 
      and operator_id = (select auth.jwt() ->> 'sub')
    )
  );

drop policy if exists "Players can submit scores" on public.matches;
create policy "Players can submit scores"
  on public.matches for update
  using ( 
    ((select auth.jwt() ->> 'sub') = player1_id or (select auth.jwt() ->> 'sub') = player2_id)
    and status != 'finalized'
  );

-- 4. Profiles Policies
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using ( (select auth.jwt() ->> 'sub') = id );

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check ( (select auth.jwt() ->> 'sub') = id );
