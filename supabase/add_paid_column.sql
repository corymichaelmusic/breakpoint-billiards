
-- Migration: Add 'paid' column to league_players
alter table public.league_players 
add column if not exists paid boolean default false;
