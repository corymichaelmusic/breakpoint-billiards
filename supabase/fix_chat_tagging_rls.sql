-- Allow authenticated users to view league players (needed for Chat Tagging)
-- This replaces the restrictive "Players can view own memberships" for SELECT

drop policy if exists "Players can view own memberships" on public.league_players;
drop policy if exists "League memberships are viewable by everyone" on public.league_players;

create policy "Authenticated users can view league players"
  on public.league_players for select
  to authenticated
  using ( true );

-- Note: We could make this more restrictive (only people in the same league),
-- but for now, simple authenticated read access matches the requirement for a directory/tagging.
