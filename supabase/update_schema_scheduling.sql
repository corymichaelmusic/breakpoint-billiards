-- Add 'setup' to league status check
alter table public.leagues drop constraint leagues_status_check;
alter table public.leagues add constraint leagues_status_check 
  check (status in ('setup', 'active', 'inactive', 'completed'));

-- League Players table (Many-to-Many)
create table public.league_players (
  id uuid primary key default uuid_generate_v4(),
  league_id uuid references public.leagues(id) not null,
  player_id text references public.profiles(id) not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(league_id, player_id)
);

-- RLS for league_players
alter table public.league_players enable row level security;

create policy "League players viewable by everyone"
  on public.league_players for select
  using ( true );

create policy "Operators can manage league players"
  on public.league_players for all
  using ( 
    exists (
      select 1 from public.leagues 
      where id = league_players.league_id 
      and operator_id = auth.uid()::text
    )
  );
