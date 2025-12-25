-- Add fargo_rating to profiles
alter table public.profiles add column if not exists fargo_rating int default 500;

-- Update matches table
alter table public.matches add column if not exists race_to_p1 int;
alter table public.matches add column if not exists race_to_p2 int;
alter table public.matches add column if not exists current_points_p1 int default 0;
alter table public.matches add column if not exists current_points_p2 int default 0;
alter table public.matches add column if not exists winner_id text references public.profiles(id);

-- Update match status check to include 'in_progress'
alter table public.matches drop constraint if exists matches_status_check;
alter table public.matches add constraint matches_status_check 
  check (status in ('scheduled', 'in_progress', 'finalized'));

-- Create games table
create table if not exists public.games (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid references public.matches(id) not null,
  game_number int not null,
  score_p1 int default 0,
  score_p2 int default 0,
  submitted_by text references public.profiles(id),
  verified_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for games
alter table public.games enable row level security;

create policy "Games viewable by everyone"
  on public.games for select
  using ( true );

create policy "Players and Operators can insert games"
  on public.games for insert
  with check (
    exists (
      select 1 from public.matches m
      left join public.leagues l on m.league_id = l.id
      where m.id = games.match_id
      and (
        m.player1_id = auth.uid()::text
        or m.player2_id = auth.uid()::text
        or l.operator_id = auth.uid()::text
      )
    )
  );

create policy "Players and Operators can update games"
  on public.games for update
  using (
    exists (
      select 1 from public.matches m
      left join public.leagues l on m.league_id = l.id
      where m.id = games.match_id
      and (
        m.player1_id = auth.uid()::text
        or m.player2_id = auth.uid()::text
        or l.operator_id = auth.uid()::text
      )
    )
  );
