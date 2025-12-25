-- Drop table to ensure clean state (DEV ONLY - removes data)
drop table if exists public.league_players;

-- Create league_players table to link profiles to leagues
create table public.league_players (
  id uuid primary key default uuid_generate_v4(),
  league_id uuid references public.leagues(id) not null,
  player_id text references public.profiles(id) not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  status text check (status in ('active', 'inactive', 'pending')) default 'active',
  unique(league_id, player_id)
);

-- Enable RLS
alter table public.league_players enable row level security;

-- Drop policies if they exist to allow re-running
drop policy if exists "League memberships are viewable by everyone" on public.league_players;
drop policy if exists "Players can join leagues" on public.league_players;
drop policy if exists "Operators can manage league members" on public.league_players;

-- Everyone can view league memberships (needed for dashboard checks)
create policy "League memberships are viewable by everyone"
  on public.league_players for select
  using ( true );

-- Players can join leagues (insert their own record)
create policy "Players can join leagues"
  on public.league_players for insert
  with check ( auth.uid()::text = player_id );

-- Operators can manage members in their leagues
create policy "Operators can manage league members"
  on public.league_players for all
  using ( 
    exists (
      select 1 from public.leagues 
      where id = league_players.league_id 
      and operator_id = auth.uid()::text
    )
  );
