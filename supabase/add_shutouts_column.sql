
alter table public.league_players 
add column if not exists shutouts int default 0;
