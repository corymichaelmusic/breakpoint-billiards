-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (synced with Clerk)
create table public.profiles (
  id text primary key, -- Matches Clerk User ID
  role text not null check (role in ('operator', 'player')) default 'player',
  full_name text,
  email text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Leagues table
create table public.leagues (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  operator_id text references public.profiles(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  status text check (status in ('active', 'inactive', 'completed')) default 'active'
);

-- Matches table
create table public.matches (
  id uuid primary key default uuid_generate_v4(),
  league_id uuid references public.leagues(id) not null,
  player1_id text references public.profiles(id) not null,
  player2_id text references public.profiles(id) not null,
  week_number int not null,
  
  -- VNEA Scoring (10 point system)
  -- Storing calculated points for MVP
  score_8ball_p1 int default 0,
  score_8ball_p2 int default 0,
  score_9ball_p1 int default 0,
  score_9ball_p2 int default 0,
  
  status text check (status in ('scheduled', 'submitted', 'finalized')) default 'scheduled',
  submitted_by text references public.profiles(id),
  submitted_at timestamp with time zone,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.leagues enable row level security;
alter table public.matches enable row level security;

-- Profiles: Everyone can read, User can update own
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using ( true );

create policy "Users can update own profile"
  on public.profiles for update
  using ( auth.uid()::text = id );

create policy "Users can insert own profile"
  on public.profiles for insert
  with check ( auth.uid()::text = id );

-- Leagues: Everyone can read, Operators can create/update
create policy "Leagues are viewable by everyone"
  on public.leagues for select
  using ( true );

create policy "Operators can create leagues"
  on public.leagues for insert
  with check ( 
    auth.uid()::text = operator_id 
    and exists (select 1 from public.profiles where id = auth.uid()::text and role = 'operator')
  );

create policy "Operators can update own leagues"
  on public.leagues for update
  using ( auth.uid()::text = operator_id );

-- Matches: Everyone can read
create policy "Matches are viewable by everyone"
  on public.matches for select
  using ( true );

-- Matches: Operators can create/manage all matches in their leagues
create policy "Operators can manage matches"
  on public.matches for all
  using ( 
    exists (
      select 1 from public.leagues 
      where id = matches.league_id 
      and operator_id = auth.uid()::text
    )
  );

-- Matches: Players can update scores for their own matches if not finalized
create policy "Players can submit scores"
  on public.matches for update
  using ( 
    (auth.uid()::text = player1_id or auth.uid()::text = player2_id)
    and status != 'finalized'
  );
