-- Add scheduled_date to matches
alter table public.matches add column if not exists scheduled_date timestamp with time zone;
alter table public.matches add column if not exists is_manually_unlocked boolean default false;

-- Create reschedule_requests table
create table if not exists public.reschedule_requests (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid references public.matches(id) not null,
  requester_id text references public.profiles(id) not null,
  requested_date timestamp with time zone not null,
  reason text,
  status text check (status in ('pending_opponent', 'pending_operator', 'approved', 'rejected')) default 'pending_opponent',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for reschedule_requests
alter table public.reschedule_requests enable row level security;

-- Everyone can read requests (simplifies logic, or restrict to involved parties)
drop policy if exists "Reschedule requests viewable by everyone" on public.reschedule_requests;
create policy "Reschedule requests viewable by everyone"
  on public.reschedule_requests for select
  using ( true );

-- Players can insert requests for their matches
drop policy if exists "Players can insert reschedule requests" on public.reschedule_requests;
create policy "Players can insert reschedule requests"
  on public.reschedule_requests for insert
  with check (
    exists (
      select 1 from public.matches m
      where m.id = reschedule_requests.match_id
      and (m.player1_id = (select auth.jwt() ->> 'sub') or m.player2_id = (select auth.jwt() ->> 'sub'))
    )
  );

-- Players (Opponent) can update status to pending_operator or rejected
drop policy if exists "Opponents can update reschedule requests" on public.reschedule_requests;
create policy "Opponents can update reschedule requests"
  on public.reschedule_requests for update
  using (
    exists (
      select 1 from public.matches m
      where m.id = reschedule_requests.match_id
      and (m.player1_id = (select auth.jwt() ->> 'sub') or m.player2_id = (select auth.jwt() ->> 'sub'))
    )
  );

-- Operators can update status to approved or rejected
drop policy if exists "Operators can update reschedule requests" on public.reschedule_requests;
create policy "Operators can update reschedule requests"
  on public.reschedule_requests for all
  using (
    exists (
      select 1 from public.matches m
      join public.leagues l on m.league_id = l.id
      where m.id = reschedule_requests.match_id
      and l.operator_id = (select auth.jwt() ->> 'sub')
    )
  );
