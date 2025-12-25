-- Add hierarchy columns to leagues table
alter table public.leagues
add column if not exists parent_league_id uuid references public.leagues(id) on delete cascade,
add column if not exists type text check (type in ('league', 'session')) default 'league';

-- Update existing leagues to be 'league' type (or 'session' if we wanted, but default is fine)
-- For now, let's assume all existing are 'leagues' (organizations) and they will create new sessions.
