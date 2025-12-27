-- Helper view to fetch “my” league memberships for two players in a league
-- Reason: league_players has restricted SELECT. We must ensure callers can only see:
-- 1. Their own membership rows, or
-- 2. Any membership if they are the operator of the league.
-- This view applies those checks using auth.jwt()->>'sub' (text) to match your policy style.

create or replace view public.v_league_players_visible as
select lp.*
from public.league_players lp
where
  -- Player can see their own membership
  lp.player_id = (auth.jwt() ->> 'sub')
  or
  -- League operator can see all memberships in their league
  exists (
    select 1
    from public.leagues l
    where l.id = lp.league_id
      and l.operator_id = (auth.jwt() ->> 'sub')
  );

-- Single-call RPC: get_match_payload
-- Design choices:
-- No SECURITY DEFINER (so it fully respects RLS).
-- Only reads allowed columns/tables.
-- Uses a lateral approach to pick just the two league_players rows for the match’s league, but only if visible to the caller via the view above.
-- Keeps JSON compact and predictable.

create or replace function public.get_match_payload(p_match_id uuid)
returns jsonb
language sql
stable
set search_path = public, pg_catalog
as $$
with m as (
  select
    m.id,
    m.league_id,
    m.player1_id,
    m.player2_id,
    m.status,
    m.created_at,
    -- Add other necessary columns here if needed by frontend
    m.status_8ball, m.status_9ball,
    m.points_8ball_p1, m.points_8ball_p2,
    m.points_9ball_p1, m.points_9ball_p2,
    m.scheduled_date, m.created_at,
    to_jsonb(m) as match_json
  from public.matches m
  where m.id = p_match_id
),
lg as (
  select
    l.id,
    to_jsonb(l) as league_json
  from public.leagues l
  join m on m.league_id = l.id
),
-- Match/Fetch players info from profiles (since match screen expects player objects with names)
-- NOTE: The original fetch matched player1:player1_id(...) join.
-- We can simulate this by fetching profiles and merging into match_json or returning separate 'profiles' key.
-- The user's prompt suggested "match core + league context + the two players’ league_players + games".
-- It didn't explicitly mention profiles, but the app needs names/avatars.
-- Profiles are public, so we can fetch them safely.
p1_profile as (
  select to_jsonb(p) as pjson from public.profiles p where p.id = (select player1_id from m)
),
p2_profile as (
  select to_jsonb(p) as pjson from public.profiles p where p.id = (select player2_id from m)
),
-- Match JSON needs to be enriched with player profiles probably?
-- Or we just return them in the payload and let frontend re-assemble.
-- The frontend code expects match.player1.full_name etc.
-- Let's stick to the prompt's structure but add profiles to be safe/complete.

-- League players visible to the caller (self or operator), for only the two players in this match
vis_lp as (
  select vlp.*
  from public.v_league_players_visible vlp
  join m on vlp.league_id = m.league_id
  where vlp.player_id in ((select player1_id from m), (select player2_id from m))
),
games as (
  select to_jsonb(g) as gjson
  from public.games g
  join m on g.match_id = m.id
  order by g.created_at asc nulls last, g.id
)
select jsonb_build_object(
  'match',
    (select match_json || jsonb_build_object(
      'player1', (select pjson from p1_profile),
      'player2', (select pjson from p2_profile)
    ) from m), 
    -- Merging profiles into match.player1/player2 to mimic Supabase join syntax sort of.
    -- Actually Supabase join returns an object.
    -- If we return raw match, it has player1_id string. 
    -- We are overwriting player1 with the profile object? No, likely adding a new key or we should match usage.
    -- Mobile App uses: match.player1.full_name.
    -- So yes, we should nest the profile under player1/player2 keys in the match object.

  'league',
    (select league_json from lg),
  'league_players',
    coalesce((select jsonb_agg(to_jsonb(vl)) from vis_lp vl), '[]'::jsonb),
  'games',
    coalesce((select jsonb_agg(gjson) from games), '[]'::jsonb)
);
$$;

-- Optional: lightweight version RPC to skip full refetch
create or replace function public.get_match_version(p_match_id uuid)
returns jsonb
language sql
stable
set search_path = public, pg_catalog
as $$
with m as (
  select id, created_at from public.matches where id = p_match_id
),
g as (
  select
    count(*)::int as games_count,
    max(created_at) as latest_game_at
  from public.games
  where match_id = p_match_id
)
select jsonb_build_object(
  'match_updated_at', (select created_at from m),
  'games_count', (select games_count from g),
  'latest_game_at', (select latest_game_at from g)
);
$$;

-- Optional indexes
create index if not exists idx_games_match on public.games(match_id);
create index if not exists idx_league_players_league_player on public.league_players(league_id, player_id);
create index if not exists idx_matches_league on public.matches(league_id);
