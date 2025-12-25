
-- Create scorecard_entries table for dual verification
create table if not exists public.scorecard_entries (
    id uuid primary key default uuid_generate_v4(),
    match_id uuid references public.matches(id) on delete cascade not null,
    scorer_id text references public.profiles(id) not null,
    
    game_number int not null,
    game_type text not null, -- '8ball' or '9ball'
    winner_id text references public.profiles(id), -- Nullable if marking 'in progress'? usually verified at end of game.
    
    score_p1 int default 0,
    score_p2 int default 0,
    
    -- Stats
    is_break_and_run boolean default false,
    is_rack_and_run boolean default false,
    is_9_on_snap boolean default false,
    is_win_zip boolean default false,
    is_early_8 boolean default false,
    is_8_wrong_pocket boolean default false,
    innings int default 1,
    dead_balls_count int default 0,
    ball_mapping jsonb,
    
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,

    -- Constraint: One entry per game per scorer
    unique(match_id, game_number, scorer_id)
);

-- Enable RLS
alter table public.scorecard_entries enable row level security;

-- Policies

-- 1. Scorers can Insert their own entries
create policy "Users can insert own scorecard entries"
    on public.scorecard_entries for insert
    with check ( auth.uid()::text = scorer_id );

-- 2. Scorers can Update their own entries
create policy "Users can update own scorecard entries"
    on public.scorecard_entries for update
    using ( auth.uid()::text = scorer_id );

-- 3. Users can Read entries for matches they are part of (or everyone if open league)
-- For simplicity, let's allow public read (like matches) so P1 can see P2's entries during verification
create policy "Scorecard entries are viewable by everyone"
    on public.scorecard_entries for select
    using ( true );

-- 4. Users can Delete their own entries
create policy "Users can delete own scorecard entries"
    on public.scorecard_entries for delete
    using ( auth.uid()::text = scorer_id );
